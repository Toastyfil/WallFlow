import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { app } from 'electron'
import axios from 'axios'
import type { AxiosResponse } from 'axios'
import type { Readable } from 'node:stream'

const USER_AGENT = 'WallFlow/1.0 (desktop wallpaper app; +https://github.com/BROO12344/WallFlow)'

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

/**
 * Turns an axios failure into something worth showing in a toast: which host
 * refused the file and why, instead of just "Request failed with status code 400".
 */
function describeDownloadError(error: unknown, url: string): string {
  const host = (() => {
    try {
      return new URL(url).host
    } catch {
      return 'the source'
    }
  })()

  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : 'Could not download the wallpaper'
  }

  const status = error.response?.status
  if (status) {
    if (status === 403 || status === 401) {
      return `${host} refused the download (HTTP ${status}) — try another wallpaper`
    }
    if (status === 404) return `${host} no longer has this file (HTTP 404)`
    if (status === 429) return `${host} is rate limiting downloads — try again shortly`
    return `${host} rejected the download (HTTP ${status})`
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return 'The download timed out — check your connection'
  }
  return `Could not reach ${host}: ${error.message}`
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

  let response: AxiosResponse<Readable>
  try {
    response = await axios.get(url, {
      responseType: 'stream',
      timeout: 180000,
      maxRedirects: 5,
      headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
      validateStatus: (status) => status >= 200 && status < 300,
    })
  } catch (error) {
    throw new Error(describeDownloadError(error, url))
  }

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
