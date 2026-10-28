import type { Orientation, SearchParams, Wallpaper } from '../types/wallpaper'
import { http } from './http'

const API = 'https://wallhaven.cc/api/v1/search'

interface WallhavenItem {
  id: string
  url: string
  category: string
  purity: string
  dimension_x: number
  dimension_y: number
  resolution: string
  path: string
  colors?: string[]
  thumbs: { large: string; original: string; small: string }
}

const RATIOS: Partial<Record<Orientation, string>> = {
  landscape: '16x9,16x10,21x9',
  portrait: '9x16,10x16,9x18',
  square: '1x1',
}

/**
 * Wallhaven needs no API key, is SFW-only with purity=100, and is built for
 * desktop wallpapers — it keeps the app useful before any keys are added.
 */
export async function searchWallhaven(
  params: SearchParams,
): Promise<{ items: Wallpaper[]; hasMore: boolean }> {
  const page = params.page ?? 1
  const perPage = params.perPage ?? 24
  const query = params.query.trim()

  const response = await http.get(API, {
    params: {
      q: query || undefined,
      page,
      categories: '100',
      purity: '100',
      sorting: query ? 'relevance' : 'toplist',
      topRange: query ? undefined : '1M',
      ratios: params.orientation ? RATIOS[params.orientation] : undefined,
      atleast: '1920x1080',
    },
  })

  const items = ((response.data?.data ?? []) as WallhavenItem[]).map<Wallpaper>((item) => ({
    id: `wallhaven:${item.id}`,
    source: 'wallhaven',
    kind: 'image',
    title: `${item.category.charAt(0).toUpperCase()}${item.category.slice(1)} · ${item.resolution}`,
    author: 'Wallhaven community',
    pageUrl: item.url,
    thumbUrl: item.thumbs?.large ?? item.thumbs?.original ?? item.path,
    previewUrl: item.thumbs?.original ?? item.path,
    fullUrl: item.path,
    width: item.dimension_x,
    height: item.dimension_y,
    color: item.colors?.[0],
  }))

  const lastPage = Number(response.data?.meta?.last_page ?? 1)
  return { items, hasMore: page < lastPage }
}
