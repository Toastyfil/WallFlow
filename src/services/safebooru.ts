import type { SearchParams, Wallpaper } from '../types/wallpaper'
import { http } from './http'
import { matchesOrientation, titleFromTags } from './media'

const API = 'https://safebooru.org/index.php'
/** Ask for a full page so the size filter still leaves something to show. */
const PAGE_LIMIT = 100
const MIN_WIDTH = 1600

interface SafebooruPost {
  id: number
  width?: number
  height?: number
  owner?: string
  tags?: string
  file_url?: string
  sample_url?: string
  preview_url?: string
}

/**
 * Safebooru is an SFW-only anime and game-art board with a public JSON API. It
 * carries a lot of the fan art that Wallhaven's anime category is built from,
 * and while individual posts vary in size the tag feed holds plenty of 1920px+
 * originals.
 */
export async function searchSafebooru(
  params: SearchParams,
): Promise<{ items: Wallpaper[]; hasMore: boolean }> {
  const page = Math.max(1, params.page ?? 1)
  const query = params.query.trim().toLowerCase().replace(/\s+/g, '_')

  const response = await http.get(API, {
    params: {
      page: 'dapi',
      s: 'post',
      q: 'index',
      json: 1,
      limit: PAGE_LIMIT,
      pid: page - 1,
      tags: query || 'wallpaper',
    },
  })

  const posts = (Array.isArray(response.data) ? response.data : []) as SafebooruPost[]

  const items = posts
    .map<Wallpaper | null>((post) => {
      const width = post.width ?? 0
      const height = post.height ?? 0
      const fullUrl = post.file_url || post.sample_url
      if (!fullUrl || width < MIN_WIDTH) return null
      if (!matchesOrientation(width, height, params.orientation)) return null

      return {
        id: `safebooru:${post.id}`,
        source: 'safebooru',
        kind: 'image',
        title: titleFromTags(post.tags, 'Safebooru wallpaper'),
        author: post.owner?.trim() || 'Safebooru community',
        pageUrl: `https://safebooru.org/index.php?page=post&s=view&id=${post.id}`,
        thumbUrl: post.preview_url || post.sample_url || fullUrl,
        previewUrl: post.sample_url || fullUrl,
        fullUrl,
        width,
        height,
      }
    })
    .filter((item): item is Wallpaper => item !== null)
    .slice(0, params.perPage ?? 24)

  return { items, hasMore: posts.length >= PAGE_LIMIT }
}
