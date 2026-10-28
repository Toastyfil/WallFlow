import type { CustomSource, Wallpaper } from '../types/wallpaper'
import { http } from './http'

const IMAGE_EXT = /\.(jpe?g|png|webp|avif|bmp|gif)(?:[?#].*)?$/i
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
      if (code.startsWith('#x') || code.startsWith('#X')) {
        return String.fromCodePoint(parseInt(code.slice(2), 16))
      }
      if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10))
      return ENTITIES[code.toLowerCase()] ?? match
    })
    .trim()
}

function stripHtml(input: string): string {
  return decodeEntities(input.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function firstMatch(source: string, pattern: RegExp): string | undefined {
  const match = source.match(pattern)
  return match?.[1] ? decodeEntities(match[1]) : undefined
}

function guessKind(url: string): 'image' | 'video' | null {
  if (VIDEO_EXT.test(url)) return 'video'
  if (IMAGE_EXT.test(url)) return 'image'
  return null
}

/** Builds a wallpaper from a single URL, using the URL as thumbnail and full image. */
export function directWallpaper(url: string, label = 'Direct link'): Wallpaper {
  const kind = guessKind(url) ?? 'image'
  const name = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? label)
  return {
    id: `custom:direct:${Buffer.from(url).toString('base64url').slice(0, 40)}`,
    source: 'custom',
    sourceLabel: label,
    kind,
    title: name || label,
    author: label,
    pageUrl: url,
    thumbUrl: url,
    previewUrl: url,
    fullUrl: url,
    videoUrl: kind === 'video' ? url : undefined,
    width: 1920,
    height: 1080,
  }
}

interface FeedEntry {
  title?: string
  link?: string
  author?: string
}

function parseEntries(xml: string): FeedEntry[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) ?? []
  return blocks.map((block) => {
    const title = firstMatch(block, /<title[^>]*>([\s\S]*?)<\/title>/i)
    const link =
      firstMatch(block, /<link[^>]*>([\s\S]*?)<\/link>/i) ||
      firstMatch(block, /<link[^>]*href=["']([^"']+)["']/i) ||
      firstMatch(block, /<guid[^>]*>([\s\S]*?)<\/guid>/i)
    const author =
      firstMatch(block, /<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i) ||
      firstMatch(block, /<author[^>]*>([\s\S]*?)<\/author>/i) ||
      firstMatch(block, /<name[^>]*>([\s\S]*?)<\/name>/i)

    return {
      title: title ? stripHtml(title) : undefined,
      link: link ? decodeEntities(link) : undefined,
      author: author
        ? stripHtml(author).replace(/^.*?\((.*?)\).*$/, '$1').replace(/^.*?:\s*/, '')
        : undefined,
    }
  })
}

function mediaUrlsIn(block: string): string[] {
  const urls: string[] = []
  const attributeRe = /(?:url|href|src)\s*=\s*["']([^"']+)["']/gi
  let match: RegExpExecArray | null
  while ((match = attributeRe.exec(block)) !== null) {
    urls.push(decodeEntities(match[1]))
  }
  // raw URLs that appear inside description HTML without an attribute
  const bareRe = /https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp|avif|mp4|webm|mov)(?:\?[^\s"'<>]*)?/gi
  while ((match = bareRe.exec(block)) !== null) {
    urls.push(match[0])
  }
  return [...new Set(urls)].map((url) => (url.startsWith('//') ? `https:${url}` : url))
}

function fromFeedEntry(entry: FeedEntry, block: string, feed: CustomSource): Wallpaper | null {
  const urls = mediaUrlsIn(block)
  const videos = urls.filter((url) => VIDEO_EXT.test(url))
  const images = urls.filter((url) => IMAGE_EXT.test(url))

  const videoUrl = videos[0]
  const imageUrl = images[0] ?? entry.link
  if (!videoUrl && !imageUrl) return null

  const kind = videoUrl ? 'video' : 'image'
  const title = entry.title ?? (kind === 'video' ? 'Feed video' : 'Feed image')

  return {
    id: `custom:${feed.id}:${Buffer.from(videoUrl ?? imageUrl ?? title).toString('base64url').slice(0, 40)}`,
    source: 'custom',
    sourceLabel: feed.name,
    kind,
    title,
    author: entry.author ?? feed.name,
    pageUrl: entry.link,
    thumbUrl: images[0] ?? imageUrl ?? '',
    previewUrl: images[0] ?? imageUrl ?? '',
    fullUrl: imageUrl ?? images[0] ?? '',
    videoUrl: videoUrl,
    width: 1920,
    height: 1080,
  }
}

export async function fetchCustomSource(feed: CustomSource, query = ''): Promise<Wallpaper[]> {
  if (feed.kind === 'direct') {
    const item = directWallpaper(feed.url, feed.name)
    if (!query || item.title.toLowerCase().includes(query.toLowerCase())) return [item]
    return []
  }

  const response = await http.get<string>(feed.url, { responseType: 'text' })
  const xml = typeof response.data === 'string' ? response.data : String(response.data)
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) ?? []
  const entries = parseEntries(xml)

  const needle = query.trim().toLowerCase()
  const items: Wallpaper[] = []

  entries.forEach((entry, index) => {
    const wallpaper = fromFeedEntry(entry, blocks[index] ?? '', feed)
    if (!wallpaper) return
    if (needle && !wallpaper.title.toLowerCase().includes(needle)) return
    items.push(wallpaper)
  })

  return items.slice(0, 30)
}
