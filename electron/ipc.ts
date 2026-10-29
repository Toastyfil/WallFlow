import { ipcMain, shell, app, BrowserWindow } from 'electron'
import { searchAll, testSource } from '../src/services'
import type {
  CustomSourceKind,
  SearchParams,
  Settings,
  SettingsPatch,
  SourceId,
  Wallpaper,
} from '../src/types/wallpaper'
import { getDisplayInfo, setDisplayMode } from './display'
import { mergeSettings } from './store/types'
import type { DataStore } from './store/types'
import { cacheDir } from './utils/download'
import { getTheme } from '../src/utils/themes'
import {
  applyWallpaper,
  clearWallpaper,
  getActiveWallpaper,
  stopVideoPlayback,
} from './wallpaper/service'
import type { RotationService } from './rotation'

function requireText(value: unknown, field: string, max = 120): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`)
  }
  return value.trim().slice(0, max)
}

function requireUrl(value: unknown): string {
  const raw = requireText(value, 'URL', 2048)
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error('Enter a valid URL')
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are supported')
  }
  return raw
}

export function registerIpcHandlers(store: DataStore, rotation: RotationService): void {
  const context = () => ({
    settings: store.getSettings(),
    customSources: store.listCustomSources(),
  })

  // ---------- sources ----------
  ipcMain.handle('sources:search', async (_event, params: SearchParams) => {
    const query: SearchParams = {
      query: typeof params?.query === 'string' ? params.query : '',
      page: Number.isFinite(params?.page) ? Number(params.page) : 1,
      perPage: 24,
      source: params?.source ?? 'all',
      orientation: params?.orientation ?? store.getSettings().orientation,
      minResolution: store.getSettings().minResolution,
    }
    return searchAll(query, context())
  })

  ipcMain.handle('sources:test', async (_event, source: SourceId) => testSource(source, context()))


  // ---------- settings ----------
  ipcMain.handle('settings:get', () => store.getSettings())

  ipcMain.handle('settings:update', (event, patch: SettingsPatch) => {
    const previous = store.getSettings()
    const next = mergeSettings(previous, (patch ?? {}) as Partial<Settings>)
    store.saveSettings(next)
    rotation.sync()

    // Keep the native caption strip in step with the palette.
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    if (senderWindow && next.theme !== previous.theme) {
      const palette = getTheme(next.theme)
      if (process.platform === 'win32') {
        senderWindow.setTitleBarOverlay({
          color: palette.base,
          symbolColor: palette.muted,
          height: 48,
        })
      }
      senderWindow.setBackgroundColor(palette.base)
    }

    return next
  })

  // ---------- collections ----------
  ipcMain.handle('collections:list', () => store.listCollections())

  ipcMain.handle('collections:create', (_event, name: string) => {
    const created = store.createCollection(requireText(name, 'Collection name', 60))
    return created
  })

  ipcMain.handle('collections:rename', (_event, id: string, name: string) => {
    store.renameCollection(requireText(id, 'Collection'), requireText(name, 'Collection name', 60))
    return store.listCollections()
  })

  ipcMain.handle('collections:remove', (_event, id: string) => {
    store.deleteCollection(requireText(id, 'Collection'))
    if (store.getSettings().rotation.collectionId === id) {
      store.saveSettings(mergeSettings(store.getSettings(), { rotation: { collectionId: null } }))
      rotation.sync()
    }
    return store.listCollections()
  })

  ipcMain.handle('collections:items', (_event, id: string) =>
    store.listCollectionItems(requireText(id, 'Collection')),
  )

  ipcMain.handle('collections:add', (_event, collectionId: string, wallpaper: Wallpaper) => {
    store.addToCollection(requireText(collectionId, 'Collection'), wallpaper)
    return store.listCollections()
  })

  ipcMain.handle('collections:removeItem', (_event, collectionId: string, wallpaperId: string) => {
    store.removeFromCollection(requireText(collectionId, 'Collection'), requireText(wallpaperId, 'Wallpaper'))
    return store.listCollections()
  })

  // ---------- favorites ----------
  ipcMain.handle('favorites:list', () => store.listFavorites())

  ipcMain.handle('favorites:toggle', (_event, wallpaper: Wallpaper) => {
    const favorite = store.toggleFavorite(wallpaper)
    return { favorite, favorites: store.listFavorites() }
  })

  // ---------- custom sources ----------
  ipcMain.handle('custom:list', () => store.listCustomSources())

  ipcMain.handle('custom:add', (_event, input: { name: string; url: string; kind: CustomSourceKind }) => {
    const source = {
      id: crypto.randomUUID(),
      name: requireText(input?.name, 'Name', 60),
      url: requireUrl(input?.url),
      kind: input?.kind === 'direct' ? ('direct' as const) : ('rss' as const),
      enabled: true,
      createdAt: Date.now(),
    }
    store.addCustomSource(source)
    return store.listCustomSources()
  })

  ipcMain.handle('custom:remove', (_event, id: string) => {
    store.removeCustomSource(requireText(id, 'Source'))
    return store.listCustomSources()
  })

  ipcMain.handle('custom:toggle', (_event, id: string, enabled: boolean) => {
    store.setCustomSourceEnabled(requireText(id, 'Source'), Boolean(enabled))
    return store.listCustomSources()
  })

  // ---------- wallpaper ----------
  ipcMain.handle('wallpaper:apply', async (_event, wallpaper: Wallpaper) => {
    if (!wallpaper?.id || !wallpaper?.fullUrl) {
      return { ok: false, message: 'This wallpaper is missing a download URL' }
    }
    return applyWallpaper(store, wallpaper, store.getSettings())
  })

  ipcMain.handle('wallpaper:clear', () => {
    clearWallpaper(store)
    stopVideoPlayback()
  })

  ipcMain.handle('wallpaper:active', () => getActiveWallpaper(store))

  ipcMain.handle('rotation:state', () => rotation.state())

  ipcMain.handle('rotation:sync', () => rotation.sync())

  // ---------- display ----------
  ipcMain.handle('display:info', () => getDisplayInfo())

  ipcMain.handle('display:set', (_event, mode: { width: number; height: number; refresh?: number }) =>
    setDisplayMode({
      width: Number(mode?.width) || 0,
      height: Number(mode?.height) || 0,
      refresh: Number(mode?.refresh) || 0,
    }),
  )

  // ---------- app ----------
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    platform: process.platform,
    storage: store.backend,
  }))

  ipcMain.handle('app:open-external', async (_event, url: string) => {
    const target = requireUrl(url)
    await shell.openExternal(target)
  })

  ipcMain.handle('app:open-cache', async () => {
    await shell.openPath(cacheDir())
  })
}
