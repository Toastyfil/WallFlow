export type SourceId = 'wallhaven' | 'commons' | 'custom'
export type BuiltInSourceId = Exclude<SourceId, 'custom'>
export type MediaKind = 'image' | 'video'
export type Orientation = 'any' | 'landscape' | 'portrait' | 'square'
export type MinResolution = 'any' | '1080p' | '1440p' | '4k'
export type CustomSourceKind = 'rss' | 'direct'

export interface Wallpaper {
  /** Globally unique: `${source}:${sourceItemId}` */
  id: string
  source: SourceId
  sourceLabel?: string
  kind: MediaKind
  title: string
  author?: string
  pageUrl?: string
  thumbUrl: string
  previewUrl: string
  /** Full-size image (kind=image) or poster frame (kind=video) */
  fullUrl: string
  videoUrl?: string
  width: number
  height: number
  /** Dominant colour, used as a loading placeholder */
  color?: string
  createdAt?: number
}

export interface SourceError {
  source: SourceId
  message: string
}

export interface SearchParams {
  query: string
  orientation?: Orientation
  page?: number
  perPage?: number
  source?: SourceId | 'all'
  minResolution?: MinResolution
}

export interface SearchResult {
  items: Wallpaper[]
  page: number
  hasMore: boolean
  errors: SourceError[]
}

export interface Settings {
  enabledSources: SourceId[]
  orientation: Orientation
  minResolution: MinResolution
  videoMuted: boolean
  rotation: {
    enabled: boolean
    intervalMinutes: number
    collectionId: string | null
    shuffle: boolean
  }
}

export interface SettingsPatch {
  enabledSources?: SourceId[]
  orientation?: Orientation
  minResolution?: MinResolution
  videoMuted?: boolean
  rotation?: Partial<Settings['rotation']>
}

export interface Collection {
  id: string
  name: string
  createdAt: number
  itemCount: number
  coverUrl: string | null
}

export interface CustomSource {
  id: string
  name: string
  url: string
  kind: CustomSourceKind
  enabled: boolean
  createdAt: number
}

export interface ActiveWallpaper {
  wallpaperId: string
  kind: MediaKind
  title: string
  source: SourceId
  appliedAt: number
  thumbUrl: string
}

export interface RotationState {
  enabled: boolean
  intervalMinutes: number
  collectionId: string | null
  nextRunAt: number | null
  lastAppliedId: string | null
}

export interface AppInfo {
  version: string
  electron: string
  platform: string
  storage: 'sqlite' | 'json'
}

export interface ApplyResult {
  ok: boolean
  message: string
}

export const DEFAULT_SETTINGS: Settings = {
  enabledSources: ['wallhaven', 'commons'],
  orientation: 'any',
  minResolution: 'any',
  videoMuted: true,
  rotation: {
    enabled: false,
    intervalMinutes: 30,
    collectionId: null,
    shuffle: true,
  },
}

export const SOURCE_META: Record<
  SourceId,
  { label: string; blurb: string; catalog: string; requiresKey: boolean }
> = {
  wallhaven: {
    label: 'Wallhaven',
    blurb: 'Curated desktop wallpapers',
    catalog: '1M+',
    requiresKey: false,
  },
  commons: {
    label: 'Wikimedia',
    blurb: 'Openly licensed photos & art',
    catalog: '100M+',
    requiresKey: false,
  },
  custom: {
    label: 'Your feeds',
    blurb: 'RSS feeds & direct links',
    catalog: '—',
    requiresKey: false,
  },
}

export const RESOLUTION_FILTERS: Record<MinResolution, number> = {
  any: 0,
  '1080p': 1080,
  '1440p': 1440,
  '4k': 2160,
}
