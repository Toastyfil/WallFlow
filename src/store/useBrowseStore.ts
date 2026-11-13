import { create } from 'zustand'
import type { Orientation, SearchParams, SourceError, Wallpaper } from '@/types/wallpaper'

const PER_PAGE = 24

/** Latest search, so late partial results from an older query are ignored. */
let activeRequestId = ''

interface BrowseState {
  query: string
  orientation: Orientation
  items: Wallpaper[]
  page: number
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  errors: SourceError[]
  initialised: boolean

  search: (query?: string, options?: { silent?: boolean }) => Promise<void>
  loadMore: () => Promise<void>
  setOrientation: (orientation: Orientation) => Promise<void>
}

export const useBrowseStore = create<BrowseState>((set, get) => ({
  query: '',
  orientation: 'any',
  items: [],
  page: 1,
  loading: false,
  loadingMore: false,
  hasMore: false,
  errors: [],
  initialised: false,

  search: async (query, options) => {
    const nextQuery = query !== undefined ? query : get().query
    const silent = options?.silent ?? false
    const requestId = crypto.randomUUID()
    activeRequestId = requestId

    set({
      query: nextQuery,
      loading: !silent,
      initialised: true,
      items: silent ? get().items : [],
      page: 1,
      hasMore: false,
      errors: [],
    })

    const params: SearchParams = {
      query: nextQuery,
      orientation: get().orientation,
      source: 'all',
      page: 1,
      perPage: PER_PAGE,
      requestId,
    }

    // Paint the first catalogs that answer, rather than waiting for the slowest.
    const unsubscribe = window.wallflow.onSearchPartial((partial) => {
      if (partial.requestId !== activeRequestId || partial.items.length === 0) return
      set({ items: partial.items, loading: false, errors: [] })
    })

    try {
      const result = await window.wallflow.search(params)
      if (activeRequestId !== requestId) return
      set({ items: result.items, hasMore: result.hasMore, errors: result.errors, loading: false })
    } catch (error) {
      if (activeRequestId !== requestId) return
      console.error('Search failed', error)
      set({
        loading: false,
        errors: [{ source: 'custom', message: error instanceof Error ? error.message : 'Search failed' }],
      })
    } finally {
      unsubscribe()
    }
  },

  loadMore: async () => {
    const { loading, loadingMore, hasMore, page, query, orientation } = get()
    if (loading || loadingMore || !hasMore) return

    set({ loadingMore: true })
    const nextPage = page + 1

    try {
      const result = await window.wallflow.search({
        query,
        orientation,
        source: 'all',
        page: nextPage,
        perPage: PER_PAGE,
      })
      const existing = new Set(get().items.map((item) => item.id))
      set({
        items: [...get().items, ...result.items.filter((item) => !existing.has(item.id))],
        page: nextPage,
        hasMore: result.hasMore,
        loadingMore: false,
      })
    } catch (error) {
      console.error('Failed to load more', error)
      set({ loadingMore: false, hasMore: false })
    }
  },

  setOrientation: async (orientation) => {
    set({ orientation })
    await get().search()
  },
}))
