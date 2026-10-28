import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'
import type { Collection, CustomSource, Settings, Wallpaper } from '../../src/types/wallpaper'
import { normalizeSettings } from './types'
import type { DataStore } from './types'

interface CollectionRow {
  id: string
  name: string
  created_at: number
  item_count: number
  cover_url: string | null
}

interface JsonRow {
  data: string
}

export class SqliteStore implements DataStore {
  readonly backend = 'sqlite' as const
  private db: DatabaseType

  constructor(filePath: string) {
    this.db = new Database(filePath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.migrate()
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS collection_items (
        collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        wallpaper_id TEXT NOT NULL,
        data TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (collection_id, wallpaper_id)
      );

      CREATE TABLE IF NOT EXISTS favorites (
        wallpaper_id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        added_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS custom_sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        kind TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `)
  }

  getSettings(): Settings {
    const row = this.db.prepare('SELECT data FROM settings WHERE id = 1').get() as JsonRow | undefined
    if (!row) return normalizeSettings(undefined)
    try {
      return normalizeSettings(JSON.parse(row.data))
    } catch {
      return normalizeSettings(undefined)
    }
  }

  saveSettings(settings: Settings): void {
    this.db
      .prepare(
        `INSERT INTO settings (id, data) VALUES (1, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
      )
      .run(JSON.stringify(settings))
  }

  listCollections(): Collection[] {
    const rows = this.db
      .prepare(
        `SELECT c.id, c.name, c.created_at,
                (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id = c.id) AS item_count,
                (SELECT json_extract(ci.data, '$.thumbUrl') FROM collection_items ci
                  WHERE ci.collection_id = c.id ORDER BY ci.added_at DESC LIMIT 1) AS cover_url
         FROM collections c
         ORDER BY c.created_at DESC`,
      )
      .all() as CollectionRow[]

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      itemCount: row.item_count,
      coverUrl: row.cover_url,
    }))
  }

  createCollection(name: string): Collection {
    const id = crypto.randomUUID()
    const createdAt = Date.now()
    this.db.prepare('INSERT INTO collections (id, name, created_at) VALUES (?, ?, ?)').run(id, name, createdAt)
    return { id, name, createdAt, itemCount: 0, coverUrl: null }
  }

  renameCollection(id: string, name: string): void {
    this.db.prepare('UPDATE collections SET name = ? WHERE id = ?').run(name, id)
  }

  deleteCollection(id: string): void {
    this.db.prepare('DELETE FROM collections WHERE id = ?').run(id)
  }

  listCollectionItems(collectionId: string): Wallpaper[] {
    const rows = this.db
      .prepare('SELECT data FROM collection_items WHERE collection_id = ? ORDER BY added_at DESC')
      .all(collectionId) as JsonRow[]
    return rows.map((row) => JSON.parse(row.data) as Wallpaper)
  }

  addToCollection(collectionId: string, wallpaper: Wallpaper): void {
    this.db
      .prepare(
        `INSERT INTO collection_items (collection_id, wallpaper_id, data, added_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(collection_id, wallpaper_id) DO NOTHING`,
      )
      .run(collectionId, wallpaper.id, JSON.stringify(wallpaper), Date.now())
  }

  removeFromCollection(collectionId: string, wallpaperId: string): void {
    this.db
      .prepare('DELETE FROM collection_items WHERE collection_id = ? AND wallpaper_id = ?')
      .run(collectionId, wallpaperId)
  }

  listFavorites(): Wallpaper[] {
    const rows = this.db.prepare('SELECT data FROM favorites ORDER BY added_at DESC').all() as JsonRow[]
    return rows.map((row) => JSON.parse(row.data) as Wallpaper)
  }

  isFavorite(wallpaperId: string): boolean {
    const row = this.db.prepare('SELECT 1 AS found FROM favorites WHERE wallpaper_id = ?').get(wallpaperId)
    return Boolean(row)
  }

  toggleFavorite(wallpaper: Wallpaper): boolean {
    if (this.isFavorite(wallpaper.id)) {
      this.db.prepare('DELETE FROM favorites WHERE wallpaper_id = ?').run(wallpaper.id)
      return false
    }
    this.db
      .prepare('INSERT INTO favorites (wallpaper_id, data, added_at) VALUES (?, ?, ?)')
      .run(wallpaper.id, JSON.stringify(wallpaper), Date.now())
    return true
  }

  listCustomSources(): CustomSource[] {
    const rows = this.db
      .prepare('SELECT * FROM custom_sources ORDER BY created_at DESC')
      .all() as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      url: String(row.url),
      kind: row.kind === 'direct' ? 'direct' : 'rss',
      enabled: Boolean(row.enabled),
      createdAt: Number(row.created_at),
    }))
  }

  addCustomSource(source: CustomSource): void {
    this.db
      .prepare('INSERT INTO custom_sources (id, name, url, kind, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(source.id, source.name, source.url, source.kind, source.enabled ? 1 : 0, source.createdAt)
  }

  removeCustomSource(id: string): void {
    this.db.prepare('DELETE FROM custom_sources WHERE id = ?').run(id)
  }

  setCustomSourceEnabled(id: string, enabled: boolean): void {
    this.db.prepare('UPDATE custom_sources SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id)
  }

  getMeta(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string | null } | undefined
    return row?.value ?? null
  }

  setMeta(key: string, value: string | null): void {
    this.db
      .prepare(
        `INSERT INTO meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value)
  }

  close(): void {
    try {
      this.db.close()
    } catch {
      /* already closed */
    }
  }
}
