import { RESOLUTION_FILTERS } from '../types/wallpaper'
import type {
  BuiltInSourceId,
  CustomSource,
  SearchParams,
  SearchResult,
  Settings,
  SourceError,
  SourceId,
  Wallpaper,
} from '../types/wallpaper'
import { searchBing } from './bing'
import { searchKonachan } from './booru'
import { fetchCustomSource } from './custom'
import { searchDeviantArt } from './deviantart'
import { describeError } from './http'
import { searchCommons } from './commons'
import { searchOpenverse } from './openverse'
import { searchSafebooru } from './safebooru'
import { searchWallhaven } from './wallhaven'

export interface SearchContext {
  settings: Settings
  customSources: CustomSource[]
}

/** Every keyless catalog the app can query, keyed by source id. */
const BUILT_IN_CLIENTS: Record<
  BuiltInSourceId,
  (params: SearchParams) => Promise<{ items: Wallpaper[]; hasMore: boolean }>
> = {
  wallhaven: searchWallhaven,
  commons: searchCommons,
  bing: searchBing,
  konachan: searchKonachan,
  safebooru: searchSafebooru,
  deviantart: searchDeviantArt,
  openverse: searchOpenverse,
}

function isBuiltIn(source: SourceId): source is BuiltInSourceId {
  return source !== 'custom' && source in BUILT_IN_CLIENTS
}

/** One slow catalog must not hold the whole feed hostage. */
const SOURCE_TIMEOUT_MS = 4000

class SourceTimeoutError extends Error {
  constructor() {
    super('Source timed out')
    this.name = 'SourceTimeoutError'
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new SourceTimeoutError()), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function interleave(lists: Wallpaper[][]): Wallpaper[] {
  const longest = Math.max(0, ...lists.map((list) => list.length))
  const merged: Wallpaper[] = []
  for (let index = 0; index < longest; index++) {
    for (const list of lists) {
      const item = list[index]
      if (item) merged.push(item)
    }
  }
  return merged
}

function dedupe(items: Wallpaper[]): Wallpaper[] {
  const seenIds = new Set<string>()
  const seenUrls = new Set<string>()
  return items.filter((item) => {
    if (seenIds.has(item.id)) return false
    const key = item.fullUrl || item.thumbUrl
    if (key && seenUrls.has(key)) return false
    seenIds.add(item.id)
    if (key) seenUrls.add(key)
    return true
  })
}

function meetsResolution(item: Wallpaper, settings: Settings): boolean {
  const min = RESOLUTION_FILTERS[settings.minResolution] ?? 0
  if (!min) return true
  return Math.min(item.width || 0, item.height || 0) >= min * 0.66
}

export async function searchAll(
  params: SearchParams,
  context: SearchContext,
  onProgress?: (items: Wallpaper[]) => void,
): Promise<SearchResult> {
  const { settings, customSources } = context
  const requested: SourceId[] = (
    params.source && params.source !== 'all' ? [params.source] : settings.enabledSources
  ).filter((source) => source === 'custom' || isBuiltIn(source))
  const errors: SourceError[] = []
  const results: Wallpaper[][] = []
  const tasks: Array<Promise<void>> = []
  const timedOut: SourceId[] = []
  const perPage = params.perPage ?? 24

  // Send a merged snapshot every time a catalog lands so the grid fills in as
  // answers arrive instead of staying blank until the slowest source replies.
  const merge = () =>
    dedupe(interleave(results)).filter((item) => meetsResolution(item, settings)).slice(0, perPage)
  const emit = () => onProgress?.(merge())

  const includeCustom = requested.includes('custom')
  if (includeCustom) {
    const feeds = customSources.filter((feed) => feed.enabled)
    if (feeds.length === 0 && requested.length === 1) {
      errors.push({ source: 'custom', message: 'No custom sources added yet' })
    }
    for (const feed of feeds) {
      tasks.push(
        withTimeout(fetchCustomSource(feed, params.query), SOURCE_TIMEOUT_MS)
          .then((items) => {
            results.push(items)
            emit()
          })
          .catch((error: unknown) => {
            if (error instanceof SourceTimeoutError) {
              timedOut.push('custom')
              return
            }
            errors.push({ source: 'custom', message: `${feed.name}: ${describeError(error)}` })
          }),
      )
    }
  }

  const runBuiltIn = async (source: BuiltInSourceId) => {
    const { items } = await withTimeout(BUILT_IN_CLIENTS[source](params), SOURCE_TIMEOUT_MS)
    results.push(items)
    emit()
  }

  for (const source of requested) {
    if (!isBuiltIn(source)) continue
    tasks.push(
      runBuiltIn(source).catch((error: unknown) => {
        if (error instanceof SourceTimeoutError) {
          timedOut.push(source)
          return
        }
        errors.push({ source, message: describeError(error) })
      }),
    )
  }

  await Promise.all(tasks)

  // Each catalog answers with a full page of its own hits; `merge` trims the
  // interleaved mix back to one page so more sources add variety, not volume.
  const items = merge()

  // A timeout is not worth an error line while other catalogs are answering.
  if (items.length === 0 && timedOut.length > 0) {
    errors.push({ source: timedOut[0], message: 'Sources are slow to respond — try again' })
  }

  return {
    items,
    page: params.page ?? 1,
    hasMore: results.some((list) => list.length >= perPage),
    errors,
  }
}

export async function testSource(
  source: SourceId,
  context: SearchContext,
): Promise<{ ok: boolean; message: string }> {
  if (source === 'custom') {
    const feed = context.customSources.find((entry) => entry.enabled)
    if (!feed) return { ok: false, message: 'No custom source added yet' }
    try {
      const items = await fetchCustomSource(feed)
      return { ok: items.length > 0, message: `${feed.name}: ${items.length} items found` }
    } catch (error) {
      return { ok: false, message: describeError(error) }
    }
  }

  if (!isBuiltIn(source)) return { ok: false, message: 'Unknown source' }

  const params: SearchParams = { query: 'nature', perPage: 3 }

  try {
    const { items } = await BUILT_IN_CLIENTS[source](params)
    return { ok: items.length > 0, message: `${items.length} wallpapers available` }
  } catch (error) {
    return { ok: false, message: describeError(error) }
  }
}
