import type { Orientation } from '../types/wallpaper'

export function matchesOrientation(width: number, height: number, orientation?: Orientation): boolean {
  if (!orientation || orientation === 'any') return true
  if (orientation === 'landscape') return width >= height
  if (orientation === 'portrait') return height >= width
  return Math.abs(width - height) / Math.max(width, height, 1) < 0.08
}

/** Image boards have no titles, so build a short readable line from their tags. */
export function titleFromTags(tags: string | undefined, fallback: string): string {
  const words = (tags ?? '')
    .split(/\s+/)
    .filter((tag) => tag && !tag.includes(':') && !/^(tagme|highres|absurdres|wallpaper)$/.test(tag))
    .slice(0, 4)
    .map((tag) => tag.replace(/_/g, ' '))

  return words.length > 0 ? words.join(' · ') : fallback
}
