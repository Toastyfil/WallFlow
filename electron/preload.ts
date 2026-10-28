import { contextBridge, ipcRenderer } from 'electron'
import type { WallFlowApi } from '../src/types/ipc'
import type { ActiveWallpaper } from '../src/types/wallpaper'

const api: WallFlowApi = {
  search: (params) => ipcRenderer.invoke('sources:search', params),
  testSource: (source) => ipcRenderer.invoke('sources:test', source),

  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch),
  },

  collections: {
    list: () => ipcRenderer.invoke('collections:list'),
    create: (name) => ipcRenderer.invoke('collections:create', name),
    rename: (id, name) => ipcRenderer.invoke('collections:rename', id, name),
    remove: (id) => ipcRenderer.invoke('collections:remove', id),
    items: (id) => ipcRenderer.invoke('collections:items', id),
    add: (collectionId, wallpaper) => ipcRenderer.invoke('collections:add', collectionId, wallpaper),
    removeItem: (collectionId, wallpaperId) =>
      ipcRenderer.invoke('collections:removeItem', collectionId, wallpaperId),
  },

  favorites: {
    list: () => ipcRenderer.invoke('favorites:list'),
    toggle: (wallpaper) => ipcRenderer.invoke('favorites:toggle', wallpaper),
  },

  customSources: {
    list: () => ipcRenderer.invoke('custom:list'),
    add: (input) => ipcRenderer.invoke('custom:add', input),
    remove: (id) => ipcRenderer.invoke('custom:remove', id),
    toggle: (id, enabled) => ipcRenderer.invoke('custom:toggle', id, enabled),
  },

  wallpaper: {
    apply: (wallpaper) => ipcRenderer.invoke('wallpaper:apply', wallpaper),
    clear: () => ipcRenderer.invoke('wallpaper:clear'),
    active: () => ipcRenderer.invoke('wallpaper:active'),
    onChanged: (handler) => {
      const listener = (_event: unknown, active: ActiveWallpaper | null) => handler(active)
      ipcRenderer.on('wallpaper:changed', listener)
      return () => ipcRenderer.removeListener('wallpaper:changed', listener)
    },
  },

  rotation: {
    state: () => ipcRenderer.invoke('rotation:state'),
    sync: () => ipcRenderer.invoke('rotation:sync'),
  },

  display: {
    info: () => ipcRenderer.invoke('display:info'),
    set: (mode) => ipcRenderer.invoke('display:set', mode),
  },

  app: {
    info: () => ipcRenderer.invoke('app:info'),
    openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
    openCacheFolder: () => ipcRenderer.invoke('app:open-cache'),
  },
}

contextBridge.exposeInMainWorld('wallflow', api)
