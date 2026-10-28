import type { ActiveWallpaper, ApplyResult, Settings, Wallpaper } from '../../src/types/wallpaper'
import type { DataStore } from '../store/types'
import { downloadMedia } from '../utils/download'
import { setDesktopWallpaper } from './apply'
import { playVideoWallpaper, stopVideoWallpaper } from './videoWindow'

const ACTIVE_KEY = 'active-wallpaper'

let changeListener: ((active: ActiveWallpaper | null) => void) | null = null

export function onWallpaperChanged(listener: (active: ActiveWallpaper | null) => void): void {
  changeListener = listener
}

export function getActiveWallpaper(store: DataStore): ActiveWallpaper | null {
  const raw = store.getMeta(ACTIVE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ActiveWallpaper
  } catch {
    return null
  }
}

function record(store: DataStore, active: ActiveWallpaper | null): void {
  store.setMeta(ACTIVE_KEY, active ? JSON.stringify(active) : null)
  changeListener?.(active)
}

export async function applyWallpaper(
  store: DataStore,
  wallpaper: Wallpaper,
  settings: Settings,
): Promise<ApplyResult> {
  try {
    if (wallpaper.kind === 'video') {
      if (!wallpaper.videoUrl) {
        return { ok: false, message: 'This video has no playable source' }
      }

      // Use a still frame as the desktop wallpaper first, so closing the app still
      // leaves a matching background instead of the previous one.
      if (wallpaper.fullUrl) {
        try {
          const poster = await downloadMedia(wallpaper.fullUrl, `${wallpaper.id}:poster`, 'image')
          await setDesktopWallpaper(poster)
        } catch (error) {
          console.warn('[wallflow] poster wallpaper failed:', (error as Error).message)
        }
      }

      const file = await downloadMedia(wallpaper.videoUrl, wallpaper.id, 'video')
      playVideoWallpaper(file, settings.videoMuted)
    } else {
      const file = await downloadMedia(wallpaper.fullUrl || wallpaper.previewUrl, wallpaper.id, 'image')
      await setDesktopWallpaper(file)
      stopVideoWallpaper()
    }

    const active: ActiveWallpaper = {
      wallpaperId: wallpaper.id,
      kind: wallpaper.kind,
      title: wallpaper.title,
      source: wallpaper.source,
      appliedAt: Date.now(),
      thumbUrl: wallpaper.thumbUrl,
    }

    record(store, active)
    return {
      ok: true,
      message:
        wallpaper.kind === 'video'
          ? 'Video wallpaper is playing behind your windows'
          : 'Desktop wallpaper updated',
    }
  } catch (error) {
    console.error('[wallflow] apply failed:', error)
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not apply the wallpaper',
    }
  }
}

export function clearWallpaper(store: DataStore): void {
  stopVideoWallpaper()
  record(store, null)
}

export function stopVideoPlayback(): void {
  stopVideoWallpaper()
}
