import { Heart, Layers, LayoutGrid, Settings2, Timer } from 'lucide-react'
import { useLibraryStore } from '@/store/useLibraryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useUiStore } from '@/store/useUiStore'
import type { Page } from '@/store/useUiStore'
import { cn } from '@/utils/cn'
import { formatInterval, formatRelativeTime } from '@/utils/format'

const NAV: Array<{ id: Page; label: string; icon: typeof LayoutGrid }> = [
  { id: 'browse', label: 'Browse', icon: LayoutGrid },
  { id: 'collections', label: 'Collections', icon: Layers },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

export function Sidebar() {
  const page = useUiStore((state) => state.page)
  const setPage = useUiStore((state) => state.setPage)
  const favorites = useLibraryStore((state) => state.favorites)
  const collections = useLibraryStore((state) => state.collections)
  const active = useUiStore((state) => state.active)
  const rotation = useSettingsStore((state) => state.settings?.rotation)

  const counts: Partial<Record<Page, number>> = {
    favorites: favorites.length,
    collections: collections.length,
  }

  return (
    <aside className="flex w-[212px] shrink-0 flex-col border-r border-hairline bg-surface/40">
      <div className="drag-region flex h-12 select-none items-center px-4">
        <span className="text-[13px] font-semibold tracking-[-0.01em] text-white">WallFlow</span>
      </div>

      <nav className="mt-3 flex-1 space-y-px px-2">
        <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-subtle">Library</p>

        {NAV.map((item) => {
          const Icon = item.icon
          const isActive = page === item.id
          const count = counts[item.id]
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPage(item.id)}
              className={cn(
                'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[12px] transition-colors duration-150',
                isActive ? 'bg-white/[0.06] text-white' : 'text-white/55 hover:bg-white/[0.03] hover:text-white/85',
              )}
            >
              <Icon className={cn('h-[14px] w-[14px]', isActive ? 'text-white/80' : 'text-white/35')} />
              <span className="flex-1 text-left">{item.label}</span>
              {typeof count === 'number' && count > 0 ? (
                <span className="text-[10px] tabular-nums text-white/30">{count}</span>
              ) : null}
            </button>
          )
        })}

        {collections.length > 0 ? (
          <>
            <p className="px-2 pb-1.5 pt-5 text-[10px] font-medium uppercase tracking-[0.1em] text-subtle">
              Collections
            </p>
            {collections.slice(0, 5).map((collection) => (
              <button
                key={collection.id}
                type="button"
                onClick={() => setPage('collections')}
                className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-[11.5px] text-white/45 transition-colors duration-150 hover:bg-white/[0.03] hover:text-white/75"
              >
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span className="truncate">{collection.name}</span>
                <span className="ml-auto text-[10px] tabular-nums text-white/25">{collection.itemCount}</span>
              </button>
            ))}
          </>
        ) : null}
      </nav>

      <div className="space-y-2 p-2">
        {rotation?.enabled ? (
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10.5px] text-white/40">
            <Timer className="h-3 w-3" />
            Rotating every {formatInterval(rotation.intervalMinutes)}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setPage('settings')}
          className="flex w-full items-center gap-2 rounded-md border border-hairline bg-white/[0.015] p-1.5 text-left transition-colors duration-150 hover:bg-white/[0.035]"
        >
          <div className="h-8 w-11 shrink-0 overflow-hidden rounded border border-hairline bg-white/[0.03]">
            {active?.thumbUrl ? (
              <img src={active.thumbUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center">
                <LayoutGrid className="h-3 w-3 text-white/20" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] text-white/70">{active ? active.title : 'No wallpaper set'}</p>
            <p className="mt-0.5 truncate text-[10px] text-subtle">
              {active ? `Applied ${formatRelativeTime(active.appliedAt)}` : 'Pick one to start'}
            </p>
          </div>
        </button>
      </div>
    </aside>
  )
}
