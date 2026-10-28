import path from 'node:path'
import { JsonStore } from './json'
import { SqliteStore } from './sqlite'
import type { DataStore } from './types'

export function openStore(userDataPath: string): DataStore {
  const dbPath = path.join(userDataPath, 'wallflow.db')

  try {
    const store = new SqliteStore(dbPath)
    console.log('[wallflow] storage: sqlite')
    return store
  } catch (error) {
    console.warn('[wallflow] better-sqlite3 unavailable, using JSON store:', (error as Error).message)
    const store = new JsonStore(path.join(userDataPath, 'wallflow-data.json'))
    console.log('[wallflow] storage: json')
    return store
  }
}
