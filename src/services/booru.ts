import type { SearchParams, Wallpaper } from '../types/wallpaper'
import { http } from './http'
import { matchesOrientation, titleFromTags } from './media'

/** Only keep posts wide enough to look sharp on a desktop. */
const MIN_WIDTH = 1600

const API = 'https://konachan.net/post.json'
const SITE = 'https://konachan.net'

interface BooruPost {
  id: number
  tags?: string
  width?: number
  height?: number
  author?: string
  file_url?: string
  jpeg_url?: string
  sample_url?: string
  preview_url?: string
}

/**
 * Konachan is a long-running wallpaper board with a public JSON endpoint. It
 * needs no key, goes up to 4K+, and `rating:safe` keeps the feed SFW — the same
 * guarantee the Wallhaven client makes with purity=100.
 */
export async function searchKonachan(
  params: SearchParams,
): Promise<{ items: Wallpaper[]; hasMore: boolean }> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(params.perPage ?? 24, 50)
  const query = params.query.trim().toLowerCase().replace(/\s+/g, '_')

  const response = await http.get(API, {
    params: { limit, page, tags: query ? `rating:safe ${query}` : 'rating:safe' },
    headers: { 'Api-User-Agent': 'WallFlow/1.1 (desktop wallpaper app)' },
  })

  const posts = (Array.isArray(response.data) ? response.data : []) as BooruPost[]

  const items = posts
    .map<Wallpaper | null>((post) => {
      const width = post.width ?? 0
      const height = post.height ?? 0
      const fullUrl = post.jpeg_url || post.file_url
      if (!fullUrl || width < MIN_WIDTH) return null
      if (!matchesOrientation(width, height, params.orientation)) return null

      return {
        id: `konachan:${post.id}`,
        source: 'konachan',
        kind: 'image',
        title: titleFromTags(post.tags, 'Konachan wallpaper'),
        author: post.author?.trim() || 'Konachan community',
        pageUrl: `${SITE}/post/show/${post.id}`,
        thumbUrl: post.preview_url || post.sample_url || fullUrl,
        previewUrl: post.sample_url || fullUrl,
        fullUrl,
        width,
        height,
      }
    })
    .filter((item): item is Wallpaper => item !== null)

  return { items, hasMore: posts.length >= limit }
}
