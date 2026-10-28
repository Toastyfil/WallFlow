import path from 'node:path'
import { app, BrowserWindow, Menu, shell } from 'electron'
import { registerIpcHandlers } from './ipc'
import { RotationService } from './rotation'
import { openStore } from './store'
import type { DataStore } from './store/types'
import { onWallpaperChanged } from './wallpaper/service'
import { stopVideoPlayback } from './wallpaper/service'

const isDev = !app.isPackaged
let mainWindow: BrowserWindow | null = null
let store: DataStore | null = null
let rotation: RotationService | null = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
}

app.setAppUserModelId('com.wallflow.desktop')

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#0a0a0b',
    title: 'WallFlow',
    titleBarStyle: 'hidden',
    titleBarOverlay:
      process.platform === 'win32'
        ? { color: '#0a0a0b', symbolColor: '#9a9aa0', height: 48 }
        : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)

  store = openStore(app.getPath('userData'))
  rotation = new RotationService(store)

  registerIpcHandlers(store, rotation)

  onWallpaperChanged((active) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('wallpaper:changed', active)
    }
  })

  createWindow()
  rotation.sync()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  rotation?.stop()
  stopVideoPlayback()
  store?.close()
})

if (isDev) {
  app.on('browser-window-created', (_event, window) => {
    window.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        window.webContents.toggleDevTools()
        event.preventDefault()
      }
    })
  })
}
