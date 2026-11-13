import type { SearchParams, Wallpaper } from '../types/wallpaper'
import { http } from './http'
import { matchesOrientation } from './media'

const API = 'https://backend.deviantart.com/rss.xml'
/** DeviantArt only renders ~1200px previews into its feed, so that is the floor. */
const MIN_WIDTH = 1000
const PAGE_SIZE = 24

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decode(input: string | undefined): string | undefined {
  if (!input) return undefined
  const text = input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
      if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(parseInt(code.slice(2), 16))
      if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10))
      return ENTITIES[code.toLowerCase()] ?? match
    })
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 0 ? text : undefined
}

function tagText(block: string, tag: string): string | undefined {
  return block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))?.[1]
}

function attribute(tagHtml: string, name: string): string | undefined {
  return tagHtml.match(new RegExp(`${name}="([^"]*)"`, 'i'))?.[1]
}

/**
 * DeviantArt publishes a keyless RSS feed of deviations. `type=deviation` keeps
 * it to artwork, and the feed marks adult submissions, which are dropped here.
 * Fan art for games and anime is its strong suit.
 */
export async function searchDeviantArt(
  params: SearchParams,
): Promise<{ items: Wallpaper[]; hasMore: boolean }> {
  const page = Math.max(1, params.page ?? 1)
  const query = params.query.trim()
  const offset = (page - 1) * PAGE_SIZE

  const response = await http.get<string>(API, {
    params: {
      q: query ? `${query} wallpaper` : 'wallpaper',
      type: 'deviation',
      offset,
    },
    responseType: 'text',
    // DeviantArt serves its RSS only to browser-like clients; the app's default
    // UA is rejected with 403.
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
    },
  })

  const xml = typeof response.data === 'string' ? response.data : String(response.data)
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []
  const items: Wallpaper[] = []

  for (const block of blocks) {
    if (items.length >= PAGE_SIZE) break
    if (/<media:rating>\s*adult\s*</i.test(block)) continue

    const content = block.match(/<media:content\b[^>]*>/i)?.[0]
    if (!content) continue

    const url = decode(attribute(content, 'url'))
    const width = Number(attribute(content, 'width') ?? 0)
    const height = Number(attribute(content, 'height') ?? 0)
    if (!url || width < MIN_WIDTH) continue
    if (!matchesOrientation(width, height, params.orientation)) continue

    const link = decode(tagText(block, 'link'))
    const author = decode(tagText(block, 'media:credit'))

    items.push({
      id: `deviantart:${link ?? url}`,
      source: 'deviantart',
      kind: 'image',
      title: decode(tagText(block, 'title')) ?? 'DeviantArt wallpaper',
      author: author ?? 'DeviantArt artist',
      pageUrl: link,
      thumbUrl: url,
      previewUrl: url,
      fullUrl: url,
      width,
      height,
    })
  }

  return { items, hasMore: blocks.length >= PAGE_SIZE }
}
