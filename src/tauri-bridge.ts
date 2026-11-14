/**
 * Tauri bridge: reproduces the Electron preload's `window.wallflow` API so the
 * React UI runs unchanged on top of the Rust backend.
 */
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import type { SearchPartial, WallFlowApi } from './types/ipc'
import type { ActiveWallpaper, Wallpaper } from './types/wallpaper'

const hasTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Local files live on disk, so their previews need the asset protocol. */
function withLocalUrls(wallpaper: Wallpaper): Wallpaper {
  if (wallpaper.source !== 'local') return wallpaper
  return {
    ...wallpaper,
    thumbUrl: convertFileSrc(wallpaper.thumbUrl),
    previewUrl: convertFileSrc(wallpaper.previewUrl),
  }
}

const api: WallFlowApi = {
  search: (params) => invoke('sources_search', { params }),
  onSearchPartial: (handler) => {
    let dispose: (() => void) | null = null
    void listen<SearchPartial>('sources:partial', (event) => handler(event.payload)).then((un) => {
      dispose = un
    })
    return () => dispose?.()
  },
  testSource: (source) => invoke('sources_test', { source }),

  settings: {
    get: () => invoke('settings_get'),
    update: (patch) => invoke('settings_update', { patch }),
  },

  collections: {
    list: () => invoke('collections_list'),
    create: (name) => invoke('collections_create', { name }),
    rename: (id, name) => invoke('collections_rename', { id, name }),
    remove: (id) => invoke('collections_remove', { id }),
    items: (id) => invoke('collections_items', { id }),
    add: (collectionId, wallpaper) => invoke('collections_add', { collectionId, wallpaper }),
    removeItem: (collectionId, wallpaperId) =>
      invoke('collections_remove_item', { collectionId, wallpaperId }),
  },

  favorites: {
    list: () => invoke('favorites_list'),
    toggle: (wallpaper) => invoke('favorites_toggle', { wallpaper }),
  },

  customSources: {
    list: () => invoke('custom_list'),
    add: (input) => invoke('custom_add', { input }),
    remove: (id) => invoke('custom_remove', { id }),
    toggle: (id, enabled) => invoke('custom_toggle', { id, enabled }),
  },

  wallpaper: {
    apply: (wallpaper) => invoke('wallpaper_apply', { wallpaper }),
    clear: () => invoke('wallpaper_clear'),
    active: () => invoke<ActiveWallpaper | null>('wallpaper_active'),
    onChanged: (handler) => {
      let dispose: (() => void) | null = null
      void listen<ActiveWallpaper | null>('wallpaper:changed', (event) => handler(event.payload)).then(
        (un) => {
          dispose = un
        },
      )
      return () => dispose?.()
    },
  },

  rotation: {
    state: () => invoke('rotation_state'),
    sync: () => invoke('rotation_sync'),
  },

  display: {
    info: () => invoke('display_info'),
    set: (mode) => invoke('display_set', { mode }),
  },

  app: {
    info: () => invoke('app_info'),
    openExternal: (url) => invoke('app_open_external', { url }),
    openCacheFolder: () => invoke('app_open_cache'),
  },

  local: {
    list: async () => (await invoke<Wallpaper[]>('local_list')).map(withLocalUrls),
    addFiles: async () => {
      const selection = await open({
        multiple: true,
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'avif'] }],
      })
      const paths = Array.isArray(selection) ? selection : selection ? [selection] : []
      if (paths.length === 0) return null
      const result = await invoke<{ added: number; items: Wallpaper[] }>('local_add', { paths })
      return { added: result.added, items: result.items.map(withLocalUrls) }
    },
    addFolder: async () => {
      const selection = await open({ directory: true, multiple: false })
      if (!selection || Array.isArray(selection)) return null
      const result = await invoke<{ added: number; items: Wallpaper[] }>('local_add', {
        paths: [selection],
      })
      return { added: result.added, items: result.items.map(withLocalUrls) }
    },
    remove: async (id) => (await invoke<Wallpaper[]>('local_remove', { id })).map(withLocalUrls),
  },
}

if (hasTauri) {
  ;(window as unknown as { wallflow: WallFlowApi }).wallflow = api
}
