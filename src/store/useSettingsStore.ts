import { create } from 'zustand'
import type { Settings, SettingsPatch } from '@/types/wallpaper'

interface SettingsState {
  settings: Settings | null
  loading: boolean
  load: () => Promise<void>
  update: (patch: SettingsPatch) => Promise<Settings | null>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loading: true,

  load: async () => {
    set({ loading: true })
    try {
      const settings = await window.wallflow.settings.get()
      set({ settings, loading: false })
    } catch (error) {
      console.error('Failed to load settings', error)
      set({ loading: false })
    }
  },

  update: async (patch) => {
    try {
      const settings = await window.wallflow.settings.update(patch)
      set({ settings })
      return settings
    } catch (error) {
      console.error('Failed to update settings', error)
      return null
    }
  },
}))
