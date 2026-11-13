import type { SearchParams, Wallpaper } from '../types/wallpaper'
import { http } from './http'

const API = 'https://www.bing.com/HPImageArchive.aspx'
const ORIGIN = 'https://www.bing.com'
const ARCHIVE_DAYS = 8

interface BingImage {
  urlbase?: string
  url?: string
  hsh?: string
  startdate?: string
  title?: string
  copyright?: string
  copyrightlink?: string
}

/**
 * Bing curates one 4K landscape photograph per day and keeps the last eight in
 * its public archive endpoint. There is no search or paging, but it is keyless
 * and the UHD file makes a sharp wallpaper.
 */
export async function searchBing(
  params: SearchParams,
): Promise<{ items: Wallpaper[]; hasMore: boolean }> {
  if ((params.page ?? 1) > 1) return { items: [], hasMore: false }
  // Every entry in the archive is landscape.
  if (params.orientation === 'portrait' || params.orientation === 'square') {
    return { items: [], hasMore: false }
  }

  const response = await http.get(API, {
    params: { format: 'js', idx: 0, n: ARCHIVE_DAYS, mkt: 'en-US' },
  })

  const items = ((response.data?.images ?? []) as BingImage[])
    .map<Wallpaper | null>((image) => {
      const base = image.urlbase ?? image.url?.split('&')[0]
      if (!base) return null

      const stem = base.startsWith('http') ? base : `${ORIGIN}${base}`

      return {
        id: `bing:${image.hsh ?? image.startdate ?? base}`,
        source: 'bing',
        kind: 'image',
        title: image.title?.trim() || 'Bing daily wallpaper',
        author: image.copyright?.trim() || 'Bing',
        pageUrl: image.copyrightlink,
        thumbUrl: `${stem}_400x240.jpg`,
        previewUrl: `${stem}_1920x1080.jpg`,
        fullUrl: `${stem}_UHD.jpg`,
        width: 3840,
        height: 2160,
      }
    })
    .filter((item): item is Wallpaper => item !== null)

  return { items, hasMore: false }
}
