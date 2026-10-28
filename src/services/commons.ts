import { http } from './http'
import type { Orientation, SearchParams, Wallpaper } from '../types/wallpaper'

const API = 'https://commons.wikimedia.org/w/api.php'
const MIN_WIDTH = 1600

interface CommonsImageInfo {
  url: string
  thumburl?: string
  thumbwidth?: number
  width: number
  height: number
  extmetadata?: Record<string, { value?: string } | undefined>
}

interface CommonsPage {
  pageid: number
  index?: number
  title: string
  imageinfo?: CommonsImageInfo[]
}

function stripHtml(value: string | undefined): string | undefined {
  if (!value) return undefined
  const text = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 0 ? text : undefined
}

function prettyTitle(title: string): string {
  return title
    .replace(/^File:/i, '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/_/g, ' ')
}

function matchesOrientation(width: number, height: number, orientation?: Orientation): boolean {
  if (!orientation || orientation === 'any') return true
  if (orientation === 'landscape') return width >= height
  if (orientation === 'portrait') return height >= width
  return Math.abs(width - height) / Math.max(width, height, 1) < 0.08
}

/**
 * Wikimedia Commons has 100M+ freely licensed files and needs no key. Searching
 * with `filetype:bitmap` keeps results to photographs rather than documents, and
 * the width floor filters out thumbnails and low-res scans.
 */
export async function searchCommons(
  params: SearchParams,
): Promise<{ items: Wallpaper[]; hasMore: boolean }> {
  const query = params.query.trim()
  const limit = Math.min(params.perPage ?? 24, 50)
  const page = params.page ?? 1

  const response = await http.get(API, {
    params: {
      action: 'query',
      format: 'json',
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      // Wikimedia only serves the thumbnail URLs it generated itself; rewriting
      // the `320px-` segment into another width returns HTTP 400, so the width
      // has to be requested here and the returned URL used as-is.
      iiurlwidth: 1280,
      generator: 'search',
      gsrsearch: `filetype:bitmap ${query || 'landscape'}`,
      gsrnamespace: 6,
      gsrlimit: limit,
      gsroffset: (page - 1) * limit,
    },
    headers: { 'Api-User-Agent': 'WallFlow/1.0 (desktop wallpaper app)' },
  })

  const pages = Object.values((response.data?.query?.pages ?? {}) as Record<string, CommonsPage>)

  const items = pages
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map<Wallpaper | null>((page) => {
      const info = page.imageinfo?.[0]
      if (!info?.thumburl || info.width < MIN_WIDTH) return null
      if (!matchesOrientation(info.width, info.height, params.orientation)) return null

      const author = stripHtml(info.extmetadata?.Artist?.value)?.slice(0, 80)
      const title = prettyTitle(page.title)

      return {
        id: `commons:${page.pageid}`,
        source: 'commons',
        kind: 'image',
        title: title || 'Wikimedia image',
        author: author || 'Wikimedia Commons',
        pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        thumbUrl: info.thumburl,
        previewUrl: info.thumburl,
        fullUrl: info.url || info.thumburl,
        width: info.width,
        height: info.height,
      }
    })
    .filter((item): item is Wallpaper => item !== null)

  return { items, hasMore: Boolean(response.data?.continue) }
}
