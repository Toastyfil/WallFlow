import { create } from 'zustand'
import type { Collection, CustomSource, Wallpaper } from '@/types/wallpaper'

interface LibraryState {
  favorites: Wallpaper[]
  favoriteIds: string[]
  collections: Collection[]
  customSources: CustomSource[]
  loading: boolean

  loadAll: () => Promise<void>
  toggleFavorite: (wallpaper: Wallpaper) => Promise<boolean>
  isFavorite: (wallpaperId: string) => boolean

  createCollection: (name: string) => Promise<Collection | null>
  renameCollection: (id: string, name: string) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  addToCollection: (collectionId: string, wallpaper: Wallpaper) => Promise<void>
  removeCollectionItem: (collectionId: string, wallpaperId: string) => Promise<void>

  addCustomSource: (input: { name: string; url: string; kind: 'rss' | 'direct' }) => Promise<void>
  removeCustomSource: (id: string) => Promise<void>
  toggleCustomSource: (id: string, enabled: boolean) => Promise<void>
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  favorites: [],
  favoriteIds: [],
  collections: [],
  customSources: [],
  loading: true,

  loadAll: async () => {
    set({ loading: true })
    try {
      const [favorites, collections, customSources] = await Promise.all([
        window.wallflow.favorites.list(),
        window.wallflow.collections.list(),
        window.wallflow.customSources.list(),
      ])
      set({
        favorites,
        favoriteIds: favorites.map((item) => item.id),
        collections,
        customSources,
        loading: false,
      })
    } catch (error) {
      console.error('Failed to load library', error)
      set({ loading: false })
    }
  },

  toggleFavorite: async (wallpaper) => {
    const { favorite, favorites } = await window.wallflow.favorites.toggle(wallpaper)
    set({ favorites, favoriteIds: favorites.map((item) => item.id) })
    return favorite
  },

  isFavorite: (wallpaperId) => get().favoriteIds.includes(wallpaperId),

  createCollection: async (name) => {
    const created = await window.wallflow.collections.create(name)
    set({ collections: await window.wallflow.collections.list() })
    return created
  },

  renameCollection: async (id, name) => {
    set({ collections: await window.wallflow.collections.rename(id, name) })
  },

  deleteCollection: async (id) => {
    set({ collections: await window.wallflow.collections.remove(id) })
  },

  addToCollection: async (collectionId, wallpaper) => {
    set({ collections: await window.wallflow.collections.add(collectionId, wallpaper) })
  },

  removeCollectionItem: async (collectionId, wallpaperId) => {
    set({ collections: await window.wallflow.collections.removeItem(collectionId, wallpaperId) })
  },

  addCustomSource: async (input) => {
    set({ customSources: await window.wallflow.customSources.add(input) })
  },

  removeCustomSource: async (id) => {
    set({ customSources: await window.wallflow.customSources.remove(id) })
  },

  toggleCustomSource: async (id, enabled) => {
    set({ customSources: await window.wallflow.customSources.toggle(id, enabled) })
  },
}))
