import { RESOLUTION_FILTERS } from '../types/wallpaper'
import type {
  CustomSource,
  SearchParams,
  SearchResult,
  Settings,
  SourceError,
  SourceId,
  Wallpaper,
} from '../types/wallpaper'
import { fetchCustomSource } from './custom'
import { describeError } from './http'
import { searchCommons } from './commons'
import { searchWallhaven } from './wallhaven'

export interface SearchContext {
  settings: Settings
  customSources: CustomSource[]
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

export async function searchAll(params: SearchParams, context: SearchContext): Promise<SearchResult> {
  const { settings, customSources } = context
  const requested = params.source && params.source !== 'all' ? [params.source] : settings.enabledSources
  const errors: SourceError[] = []
  const results: Wallpaper[][] = []
  const tasks: Array<Promise<void>> = []

  const includeCustom = requested.includes('custom')
  if (includeCustom) {
    const feeds = customSources.filter((feed) => feed.enabled)
    if (feeds.length === 0 && requested.length === 1) {
      errors.push({ source: 'custom', message: 'No custom sources added yet' })
    }
    for (const feed of feeds) {
      tasks.push(
        fetchCustomSource(feed, params.query)
          .then((items) => {
            results.push(items)
          })
          .catch((error: unknown) => {
            errors.push({ source: 'custom', message: `${feed.name}: ${describeError(error)}` })
          }),
      )
    }
  }

  const runBuiltIn = async (source: BuiltInSource) => {
    const { items } = source === 'wallhaven' ? await searchWallhaven(params) : await searchCommons(params)
    results.push(items)
  }

  for (const source of requested) {
    if (source === 'custom') continue
    tasks.push(
      runBuiltIn(source).catch((error: unknown) => {
        errors.push({ source, message: describeError(error) })
      }),
    )
  }

  await Promise.all(tasks)

  const merged = dedupe(interleave(results)).filter((item) => meetsResolution(item, settings))

  return {
    items: merged,
    page: params.page ?? 1,
    hasMore: results.some((list) => list.length >= (params.perPage ?? 24)),
    errors,
  }
}

type BuiltInSource = Exclude<SourceId, 'custom'>

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

  const params: SearchParams = { query: 'nature', perPage: 3 }

  try {
    const { items } =
      source === 'wallhaven' ? await searchWallhaven(params) : await searchCommons(params)
    return { ok: items.length > 0, message: `${items.length} wallpapers available` }
  } catch (error) {
    return { ok: false, message: describeError(error) }
  }
}
