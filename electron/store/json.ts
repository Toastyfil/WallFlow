import fs from 'node:fs'
import path from 'node:path'
import type { Collection, CustomSource, Settings, Wallpaper } from '../../src/types/wallpaper'
import { normalizeSettings } from './types'
import type { DataStore } from './types'

interface JsonData {
  settings: Settings
  collections: Array<{ id: string; name: string; createdAt: number; items: Wallpaper[] }>
  favorites: Array<{ wallpaper: Wallpaper; addedAt: number }>
  customSources: CustomSource[]
  meta: Record<string, string | null>
}

/**
 * Fallback used when the native SQLite module cannot load (e.g. ABI mismatch on a
 * machine without build tools). Same API, single JSON document on disk.
 */
export class JsonStore implements DataStore {
  readonly backend = 'json' as const
  private filePath: string
  private data: JsonData

  constructor(filePath: string) {
    this.filePath = filePath
    this.data = this.read()
  }

  private read(): JsonData {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<JsonData>
      return {
        settings: normalizeSettings(parsed.settings),
        collections: Array.isArray(parsed.collections)
          ? parsed.collections.map((c) => ({
              id: String(c.id),
              name: String(c.name),
              createdAt: Number(c.createdAt) || Date.now(),
              items: Array.isArray(c.items) ? c.items : [],
            }))
          : [],
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
        customSources: Array.isArray(parsed.customSources) ? parsed.customSources : [],
        meta: parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {},
      }
    } catch {
      return {
        settings: normalizeSettings(undefined),
        collections: [],
        favorites: [],
        customSources: [],
        meta: {},
      }
    }
  }

  private write(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    const tmp = `${this.filePath}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8')
    fs.renameSync(tmp, this.filePath)
  }

  getSettings(): Settings {
    return this.data.settings
  }

  saveSettings(settings: Settings): void {
    this.data.settings = settings
    this.write()
  }

  listCollections(): Collection[] {
    return [...this.data.collections]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((collection) => ({
        id: collection.id,
        name: collection.name,
        createdAt: collection.createdAt,
        itemCount: collection.items.length,
        coverUrl: collection.items[0]?.thumbUrl ?? null,
      }))
  }

  createCollection(name: string): Collection {
    const collection = { id: crypto.randomUUID(), name, createdAt: Date.now(), items: [] as Wallpaper[] }
    this.data.collections.push(collection)
    this.write()
    return { id: collection.id, name, createdAt: collection.createdAt, itemCount: 0, coverUrl: null }
  }

  renameCollection(id: string, name: string): void {
    const collection = this.data.collections.find((c) => c.id === id)
    if (!collection) return
    collection.name = name
    this.write()
  }

  deleteCollection(id: string): void {
    this.data.collections = this.data.collections.filter((c) => c.id !== id)
    this.write()
  }

  listCollectionItems(collectionId: string): Wallpaper[] {
    return this.data.collections.find((c) => c.id === collectionId)?.items ?? []
  }

  addToCollection(collectionId: string, wallpaper: Wallpaper): void {
    const collection = this.data.collections.find((c) => c.id === collectionId)
    if (!collection) return
    if (collection.items.some((item) => item.id === wallpaper.id)) return
    collection.items.unshift(wallpaper)
    this.write()
  }

  removeFromCollection(collectionId: string, wallpaperId: string): void {
    const collection = this.data.collections.find((c) => c.id === collectionId)
    if (!collection) return
    collection.items = collection.items.filter((item) => item.id !== wallpaperId)
    this.write()
  }

  listFavorites(): Wallpaper[] {
    return this.data.favorites.map((entry) => entry.wallpaper)
  }

  isFavorite(wallpaperId: string): boolean {
    return this.data.favorites.some((entry) => entry.wallpaper.id === wallpaperId)
  }

  toggleFavorite(wallpaper: Wallpaper): boolean {
    if (this.isFavorite(wallpaper.id)) {
      this.data.favorites = this.data.favorites.filter((entry) => entry.wallpaper.id !== wallpaper.id)
      this.write()
      return false
    }
    this.data.favorites.unshift({ wallpaper, addedAt: Date.now() })
    this.write()
    return true
  }

  listCustomSources(): CustomSource[] {
    return [...this.data.customSources].sort((a, b) => b.createdAt - a.createdAt)
  }

  addCustomSource(source: CustomSource): void {
    this.data.customSources.push(source)
    this.write()
  }

  removeCustomSource(id: string): void {
    this.data.customSources = this.data.customSources.filter((source) => source.id !== id)
    this.write()
  }

  setCustomSourceEnabled(id: string, enabled: boolean): void {
    const source = this.data.customSources.find((entry) => entry.id === id)
    if (!source) return
    source.enabled = enabled
    this.write()
  }

  getMeta(key: string): string | null {
    return this.data.meta[key] ?? null
  }

  setMeta(key: string, value: string | null): void {
    this.data.meta[key] = value
    this.write()
  }

  close(): void {
    this.write()
  }
}
