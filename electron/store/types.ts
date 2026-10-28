import { DEFAULT_SETTINGS } from '../../src/types/wallpaper'
import type { Collection, CustomSource, Settings, SettingsPatch, Wallpaper } from '../../src/types/wallpaper'

export interface DataStore {
  readonly backend: 'sqlite' | 'json'

  getSettings(): Settings
  saveSettings(settings: Settings): void

  listCollections(): Collection[]
  createCollection(name: string): Collection
  renameCollection(id: string, name: string): void
  deleteCollection(id: string): void
  listCollectionItems(collectionId: string): Wallpaper[]
  addToCollection(collectionId: string, wallpaper: Wallpaper): void
  removeFromCollection(collectionId: string, wallpaperId: string): void

  listFavorites(): Wallpaper[]
  isFavorite(wallpaperId: string): boolean
  toggleFavorite(wallpaper: Wallpaper): boolean

  listCustomSources(): CustomSource[]
  addCustomSource(source: CustomSource): void
  removeCustomSource(id: string): void
  setCustomSourceEnabled(id: string, enabled: boolean): void

  getMeta(key: string): string | null
  setMeta(key: string, value: string | null): void

  close(): void
}

const SOURCE_IDS = ['wallhaven', 'commons', 'custom']

/** Fills in anything missing from persisted settings so upgrades never break the UI. */
export function normalizeSettings(raw: unknown): Settings {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>
  const rotation = (input.rotation ?? {}) as Partial<Settings['rotation']>

  const storedSources = Array.isArray(input.enabledSources)
    ? input.enabledSources
    : DEFAULT_SETTINGS.enabledSources

  // `openverse` was replaced by Wikimedia Commons; carry the choice over.
  const migratedSources = storedSources.map((source) =>
    (source as string) === 'openverse' ? 'commons' : source,
  )

  const enabledSources = migratedSources.filter(
    (source): source is Settings['enabledSources'][number] => SOURCE_IDS.includes(source as string),
  )

  return {
    enabledSources: enabledSources.length > 0 ? enabledSources : DEFAULT_SETTINGS.enabledSources,
    orientation: ['any', 'landscape', 'portrait', 'square'].includes(input.orientation as string)
      ? (input.orientation as Settings['orientation'])
      : DEFAULT_SETTINGS.orientation,
    minResolution: ['any', '1080p', '1440p', '4k'].includes(input.minResolution as string)
      ? (input.minResolution as Settings['minResolution'])
      : DEFAULT_SETTINGS.minResolution,
    videoMuted: typeof input.videoMuted === 'boolean' ? input.videoMuted : DEFAULT_SETTINGS.videoMuted,
    rotation: {
      enabled: Boolean(rotation.enabled),
      intervalMinutes:
        typeof rotation.intervalMinutes === 'number' && rotation.intervalMinutes >= 1
          ? Math.min(1440, Math.round(rotation.intervalMinutes))
          : DEFAULT_SETTINGS.rotation.intervalMinutes,
      collectionId: typeof rotation.collectionId === 'string' ? rotation.collectionId : null,
      shuffle: rotation.shuffle === undefined ? true : Boolean(rotation.shuffle),
    },
  }
}

export function mergeSettings(current: Settings, patch: SettingsPatch): Settings {
  return normalizeSettings({
    ...current,
    ...patch,
    rotation: { ...current.rotation, ...(patch.rotation ?? {}) },
  })
}
