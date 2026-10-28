import { create } from 'zustand'
import type { ActiveWallpaper, Wallpaper } from '@/types/wallpaper'

export type Page = 'browse' | 'collections' | 'favorites' | 'settings'

interface UiState {
  page: Page
  setPage: (page: Page) => void

  preview: Wallpaper | null
  previewOpen: boolean
  openPreview: (wallpaper: Wallpaper) => void
  closePreview: () => void

  saveTarget: Wallpaper | null
  setSaveTarget: (wallpaper: Wallpaper | null) => void

  active: ActiveWallpaper | null
  setActive: (active: ActiveWallpaper | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  page: 'browse',
  setPage: (page) => set({ page }),

  preview: null,
  previewOpen: false,
  openPreview: (wallpaper) => set({ preview: wallpaper, previewOpen: true }),
  closePreview: () => set({ previewOpen: false }),

  saveTarget: null,
  setSaveTarget: (wallpaper) => set({ saveTarget: wallpaper }),

  active: null,
  setActive: (active) => set({ active }),
}))
