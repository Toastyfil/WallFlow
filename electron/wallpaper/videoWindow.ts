import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, screen } from 'electron'

let videoWindow: BrowserWindow | null = null

/**
 * Plays a video wallpaper in a borderless window pinned to the desktop area.
 *
 * The window is click-through and non-focusable so it never interferes with the
 * desktop; it is deliberately not always-on-top, so normal windows cover it.
 */
export function playVideoWallpaper(filePath: string, muted: boolean): void {
  stopVideoWallpaper()

  const { workArea } = screen.getPrimaryDisplay()

  videoWindow = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    frame: false,
    transparent: false,
    backgroundColor: '#000000',
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    title: 'WallFlow video wallpaper',
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  videoWindow.setIgnoreMouseEvents(true, { forward: false })
  videoWindow.setAlwaysOnTop(false)
  videoWindow.setSkipTaskbar(true)
  videoWindow.setMenu(null)

  const src = pathToFileURL(filePath).toString()
  void videoWindow.loadFile(path.join(__dirname, 'video.html'), {
    query: { src, muted: muted ? '1' : '0' },
  })

  videoWindow.once('ready-to-show', () => {
    videoWindow?.showInactive()
  })

  videoWindow.on('closed', () => {
    videoWindow = null
  })
}

export function stopVideoWallpaper(): void {
  if (!videoWindow) return
  const window = videoWindow
  videoWindow = null
  if (!window.isDestroyed()) window.destroy()
}

export function isVideoWallpaperActive(): boolean {
  return Boolean(videoWindow && !videoWindow.isDestroyed())
}
