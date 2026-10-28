import type { RotationState, Wallpaper } from '../src/types/wallpaper'
import type { DataStore } from './store/types'
import { applyWallpaper } from './wallpaper/service'

const LAST_ID_KEY = 'rotation:last-id'

export class RotationService {
  private timer: NodeJS.Timeout | null = null
  private nextRunAt: number | null = null
  private running = false

  constructor(private readonly store: DataStore) {}

  state(): RotationState {
    const settings = this.store.getSettings()
    return {
      enabled: settings.rotation.enabled,
      intervalMinutes: settings.rotation.intervalMinutes,
      collectionId: settings.rotation.collectionId,
      nextRunAt: settings.rotation.enabled ? this.nextRunAt : null,
      lastAppliedId: this.store.getMeta(LAST_ID_KEY),
    }
  }

  /** Re-reads settings and restarts (or cancels) the timer. */
  sync(): RotationState {
    this.clearTimer()
    const settings = this.store.getSettings()

    if (!settings.rotation.enabled) {
      this.nextRunAt = null
      return this.state()
    }

    this.schedule(settings.rotation.intervalMinutes * 60_000)
    return this.state()
  }

  stop(): void {
    this.clearTimer()
    this.nextRunAt = null
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private schedule(delayMs: number): void {
    this.clearTimer()
    this.nextRunAt = Date.now() + delayMs
    this.timer = setTimeout(() => {
      void this.tick()
    }, delayMs)
  }

  private pool(): Wallpaper[] {
    const settings = this.store.getSettings()
    const collectionId = settings.rotation.collectionId
    if (!collectionId) return this.store.listFavorites()
    return this.store.listCollectionItems(collectionId)
  }

  private async tick(): Promise<void> {
    if (this.running) return
    this.running = true

    const settings = this.store.getSettings()

    try {
      const pool = this.pool()
      if (pool.length === 0) {
        console.warn('[wallflow] rotation skipped — the selected collection is empty')
        return
      }

      const lastId = this.store.getMeta(LAST_ID_KEY)
      const candidates = pool.length > 1 ? pool.filter((item) => item.id !== lastId) : pool
      const next = settings.rotation.shuffle
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : candidates[0]

      if (!next) return

      const result = await applyWallpaper(this.store, next, settings)
      if (result.ok) {
        this.store.setMeta(LAST_ID_KEY, next.id)
        console.log(`[wallflow] rotated wallpaper → ${next.title}`)
      } else {
        console.warn('[wallflow] rotation apply failed:', result.message)
      }
    } catch (error) {
      console.error('[wallflow] rotation tick failed:', error)
    } finally {
      this.running = false
      if (this.store.getSettings().rotation.enabled) {
        this.schedule(this.store.getSettings().rotation.intervalMinutes * 60_000)
      } else {
        this.nextRunAt = null
      }
    }
  }
}
