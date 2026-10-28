import type {
  ActiveWallpaper,
  AppInfo,
  ApplyResult,
  Collection,
  CustomSource,
  RotationState,
  SearchParams,
  SearchResult,
  Settings,
  SettingsPatch,
  SourceId,
  Wallpaper,
} from './wallpaper'

export interface DisplayMode {
  width: number
  height: number
  refresh: number
}

export interface DisplayInfo {
  current: DisplayMode
  modes: DisplayMode[]
}

export interface WallFlowApi {
  search(params: SearchParams): Promise<SearchResult>
  testSource(source: SourceId): Promise<{ ok: boolean; message: string }>

  settings: {
    get(): Promise<Settings>
    update(patch: SettingsPatch): Promise<Settings>
  }

  collections: {
    list(): Promise<Collection[]>
    create(name: string): Promise<Collection>
    rename(id: string, name: string): Promise<Collection[]>
    remove(id: string): Promise<Collection[]>
    items(id: string): Promise<Wallpaper[]>
    add(collectionId: string, wallpaper: Wallpaper): Promise<Collection[]>
    removeItem(collectionId: string, wallpaperId: string): Promise<Collection[]>
  }

  favorites: {
    list(): Promise<Wallpaper[]>
    toggle(wallpaper: Wallpaper): Promise<{ favorite: boolean; favorites: Wallpaper[] }>
  }

  customSources: {
    list(): Promise<CustomSource[]>
    add(input: { name: string; url: string; kind: 'rss' | 'direct' }): Promise<CustomSource[]>
    remove(id: string): Promise<CustomSource[]>
    toggle(id: string, enabled: boolean): Promise<CustomSource[]>
  }

  wallpaper: {
    apply(wallpaper: Wallpaper): Promise<ApplyResult>
    clear(): Promise<void>
    active(): Promise<ActiveWallpaper | null>
    onChanged(handler: (active: ActiveWallpaper | null) => void): () => void
  }

  rotation: {
    state(): Promise<RotationState>
    sync(): Promise<RotationState>
  }

  display: {
    info(): Promise<DisplayInfo>
    set(mode: DisplayMode): Promise<{ ok: boolean; message: string }>
  }

  app: {
    info(): Promise<AppInfo>
    openExternal(url: string): Promise<void>
    openCacheFolder(): Promise<void>
  }
}
