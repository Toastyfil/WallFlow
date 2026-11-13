import type { Orientation, SearchParams, Wallpaper } from '../types/wallpaper'
import { http } from './http'

const API = 'https://api.openverse.org/v1/images/'
/** Anonymous Openverse access is capped at 20 results per page. */
const MAX_PER_PAGE = 20

const ASPECT: Partial<Record<Orientation, string>> = {
  landscape: 'wide',
  portrait: 'tall',
  square: 'square',
}

interface OpenverseItem {
  id: string
  title?: string
  url?: string
  thumbnail?: string
  creator?: string
  license?: string
  license_version?: string
  foreign_landing_url?: string
  width?: number
  height?: number
}

/**
 * Openverse indexes hundreds of millions of openly licensed images across
 * Flickr, Wikimedia, museums and more. It needs no key, but anonymous callers
 * get 20 results per page and a small daily request budget, so paging stays
 * shallow and the source is off by default.
 */
export async function searchOpenverse(
  params: SearchParams,
): Promise<{ items: Wallpaper[]; hasMore: boolean }> {
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(params.perPage ?? 24, MAX_PER_PAGE)
  const query = params.query.trim()

  const response = await http.get(API, {
    // Unfiltered Openverse queries time out, so an empty search still asks for something.
    params: {
      q: query || 'nature',
      page,
      page_size: perPage,
      size: 'large',
      aspect_ratio: ASPECT[params.orientation ?? 'any'],
      mature: false,
    },
    headers: { 'Api-User-Agent': 'WallFlow/1.0 (desktop wallpaper app)' },
  })

  const items = ((response.data?.results ?? []) as OpenverseItem[])
    .map<Wallpaper | null>((item) => {
      const fullUrl = item.url
      if (!fullUrl || /\.svgz?$/i.test(fullUrl.split('?')[0])) return null

      const width = item.width ?? 0
      const height = item.height ?? 0
      if (width > 0 && width < 1200) return null

      const creator = item.creator?.trim()
      const license = item.license
        ? `${item.license.toUpperCase()} ${item.license_version ?? ''}`.trim()
        : 'CC'
      const title = item.title?.replace(/^file:/i, '').trim()

      return {
        id: `openverse:${item.id}`,
        source: 'openverse',
        kind: 'image',
        title: title || 'Openverse image',
        author: creator ? `${creator} · ${license}` : `Openverse · ${license}`,
        pageUrl: item.foreign_landing_url,
        thumbUrl: item.thumbnail || fullUrl,
        previewUrl: fullUrl,
        fullUrl,
        width: width || 1920,
        height: height || 1080,
      }
    })
    .filter((item): item is Wallpaper => item !== null)

  const pageCount = Number(response.data?.page_count ?? 1)
  return { items, hasMore: page < pageCount }
}
