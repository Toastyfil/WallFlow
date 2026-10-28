import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { app } from 'electron'
import axios from 'axios'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.bmp', '.gif']
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v']

const CONTENT_TYPE_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
}

export function cacheDir(): string {
  return path.join(app.getPath('userData'), 'wallpaper-cache')
}

function extensionFor(url: string, contentType: string | undefined, kind: 'image' | 'video'): string {
  const pathname = (() => {
    try {
      return new URL(url).pathname
    } catch {
      return url
    }
  })()
  const fromUrl = path.extname(pathname).toLowerCase()
  const allowed = kind === 'video' ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS
  if (allowed.includes(fromUrl)) return fromUrl

  const normalized = (contentType ?? '').split(';')[0].trim().toLowerCase()
  const fromType = CONTENT_TYPE_EXT[normalized]
  if (fromType) return fromType

  // Unsplash-style URLs without an extension still resolve via content type; fall back to jpg.
  return kind === 'video' ? '.mp4' : '.jpg'
}

/**
 * Streams a remote asset into the cache. Returns the local path, reusing an
 * existing file when the same wallpaper was already downloaded.
 */
export async function downloadMedia(
  url: string,
  id: string,
  kind: 'image' | 'video',
): Promise<string> {
  const dir = cacheDir()
  await fs.mkdir(dir, { recursive: true })

  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: 180000,
    maxRedirects: 5,
    headers: { 'User-Agent': 'WallFlow/1.0' },
    validateStatus: (status) => status >= 200 && status < 300,
  })

  const extension = extensionFor(url, String(response.headers['content-type'] ?? ''), kind)
  const hash = createHash('sha1').update(`${id}:${url}`).digest('hex').slice(0, 16)
  const target = path.join(dir, `${hash}${extension}`)

  try {
    const stats = await fs.stat(target)
    if (stats.size > 1024) {
      response.data.destroy?.()
      return target
    }
  } catch {
    /* not cached yet */
  }

  const temporary = `${target}.part`
  await pipeline(response.data, createWriteStream(temporary))
  await fs.rename(temporary, target)
  return target
}

/** Small helper used by the rotation scheduler to keep the cache from growing forever. */
export async function cacheSize(): Promise<number> {
  try {
    const entries = await fs.readdir(cacheDir())
    let total = 0
    for (const entry of entries) {
      const stats = await fs.stat(path.join(cacheDir(), entry))
      total += stats.size
    }
    return total
  } catch {
    return 0
  }
}
