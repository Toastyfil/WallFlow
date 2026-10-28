import { create } from 'zustand'
import type { Orientation, SearchParams, SourceError, SourceId, Wallpaper } from '@/types/wallpaper'

const PER_PAGE = 24

interface BrowseState {
  query: string
  orientation: Orientation
  sourceFilter: SourceId | 'all'
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
  setSourceFilter: (source: SourceId | 'all') => Promise<void>
}

export const useBrowseStore = create<BrowseState>((set, get) => ({
  query: '',
  orientation: 'any',
  sourceFilter: 'all',
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
    set({
      query: nextQuery,
      loading: !silent,
      initialised: true,
      items: silent ? get().items : [],
      page: 1,
    })

    const params: SearchParams = {
      query: nextQuery,
      orientation: get().orientation,
      source: get().sourceFilter,
      page: 1,
      perPage: PER_PAGE,
    }

    try {
      const result = await window.wallflow.search(params)
      set({ items: result.items, hasMore: result.hasMore, errors: result.errors, loading: false })
    } catch (error) {
      console.error('Search failed', error)
      set({
        loading: false,
        errors: [{ source: 'custom', message: error instanceof Error ? error.message : 'Search failed' }],
      })
    }
  },

  loadMore: async () => {
    const { loading, loadingMore, hasMore, page, query, orientation, sourceFilter } = get()
    if (loading || loadingMore || !hasMore) return

    set({ loadingMore: true })
    const nextPage = page + 1

    try {
      const result = await window.wallflow.search({
        query,
        orientation,
        source: sourceFilter,
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

  setSourceFilter: async (sourceFilter) => {
    set({ sourceFilter })
    await get().search()
  },
}))
