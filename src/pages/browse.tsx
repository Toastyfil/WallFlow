import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { WallpaperGrid } from '@/components/wallpaper/wallpaper-grid'
import { useBrowseStore } from '@/store/useBrowseStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useUiStore } from '@/store/useUiStore'
import { cn } from '@/utils/cn'
import { SOURCE_META } from '@/types/wallpaper'
import type { Orientation, SourceId } from '@/types/wallpaper'

const CATEGORIES = ['Nature', 'Abstract', 'Minimal', 'Space', 'City', 'Ocean', 'Mountains', 'Neon', 'Textures', 'Anime']

const ORIENTATIONS: Array<{ value: Orientation; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'landscape', label: 'Wide' },
  { value: 'portrait', label: 'Tall' },
  { value: 'square', label: 'Square' },
]

export function BrowsePage() {
  const {
    query,
    items,
    loading,
    loadingMore,
    hasMore,
    errors,
    initialised,
    search,
    loadMore,
    orientation,
    setOrientation,
    sourceFilter,
    setSourceFilter,
  } = useBrowseStore()
  const settings = useSettingsStore((state) => state.settings)
  const setPage = useUiStore((state) => state.setPage)

  useEffect(() => {
    if (!initialised) void search('')
  }, [initialised, search])

  const enabledSources = settings?.enabledSources ?? ['wallhaven', 'commons']
  const sources: Array<{ id: SourceId | 'all'; label: string }> = [
    { id: 'all', label: 'All sources' },
    ...enabledSources.map((id) => ({ id, label: SOURCE_META[id].label })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-[17px] font-semibold tracking-tight text-white">{query ? query : 'Explore'}</h1>
          <span className="text-[11.5px] tabular-nums text-subtle">
            {loading ? 'searching…' : `${items.length} wallpapers`}
          </span>
        </div>

        <div className="flex items-center gap-0.5 rounded-lg border border-hairline bg-white/[0.02] p-0.5">
          {sources.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => void setSourceFilter(source.id)}
              className={cn(
                'h-7 rounded-[6px] px-2.5 text-[11px] transition-colors duration-150',
                sourceFilter === source.id
                  ? 'bg-white/[0.08] font-medium text-white'
                  : 'text-white/45 hover:text-white/75',
              )}
            >
              {source.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => void search('')}
            className={cn(
              'h-7 shrink-0 rounded-full border px-2.5 text-[11px] transition-colors duration-150',
              !query
                ? 'border-white/15 bg-white/[0.06] text-white'
                : 'border-transparent text-white/45 hover:bg-white/[0.04] hover:text-white/80',
            )}
          >
            Trending
          </button>
          {CATEGORIES.map((category) => {
            const active = query.toLowerCase() === category.toLowerCase()
            return (
              <button
                key={category}
                type="button"
                onClick={() => void search(category.toLowerCase())}
                className={cn(
                  'h-7 shrink-0 rounded-full border px-2.5 text-[11px] transition-colors duration-150',
                  active
                    ? 'border-white/15 bg-white/[0.06] text-white'
                    : 'border-transparent text-white/45 hover:bg-white/[0.04] hover:text-white/80',
                )}
              >
                {category}
              </button>
            )
          })}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 border-l border-hairline pl-3">
          {ORIENTATIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => void setOrientation(option.value)}
              className={cn(
                'rounded px-2 py-1 text-[11px] transition-colors duration-150',
                orientation === option.value ? 'text-white' : 'text-white/40 hover:text-white/70',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {errors.length > 0 && items.length > 0 ? (
        <p className="text-[11px] text-subtle">
          {errors[0].message}
          {errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}
        </p>
      ) : null}

      <WallpaperGrid
        wallpapers={items}
        loading={loading}
        empty={
          <EmptyState
            illustration="search"
            title={query ? 'No matches' : 'Nothing loaded'}
            description={
              query
                ? `Nothing for “${query}” in the selected sources. Try a different keyword or switch sources.`
                : 'Check your connection or enable another source in Settings.'
            }
            action={
              <div className="flex items-center gap-2">
                {query ? (
                  <Button variant="secondary" size="sm" onClick={() => void search('')}>
                    Clear
                  </Button>
                ) : null}
                <Button variant="secondary" size="sm" onClick={() => setPage('settings')}>
                  Sources
                </Button>
              </div>
            }
          />
        }
      />

      {items.length > 0 && hasMore ? (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" size="sm" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {loadingMore ? 'Loading' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
