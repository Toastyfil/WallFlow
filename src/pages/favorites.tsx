import { Heart, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { WallpaperGrid } from '@/components/wallpaper/wallpaper-grid'
import { useLibraryStore } from '@/store/useLibraryStore'
import { useUiStore } from '@/store/useUiStore'

export function FavoritesPage() {
  const favorites = useLibraryStore((state) => state.favorites)
  const loading = useLibraryStore((state) => state.loading)
  const setPage = useUiStore((state) => state.setPage)

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-white">Favorites</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {favorites.length > 0
              ? `${favorites.length} wallpaper${favorites.length === 1 ? '' : 's'} you kept close`
              : 'Wallpapers you saved to keep'}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setPage('browse')}>
          <LayoutGrid className="h-3.5 w-3.5" />
          Browse
        </Button>
      </div>

      <WallpaperGrid
        wallpapers={favorites}
        loading={loading && favorites.length === 0}
        skeletonCount={8}
        empty={
          <EmptyState
            illustration="heart"
            title="No favorites yet"
            description="Tap the heart on any wallpaper and it will show up here — ready to apply whenever your desktop needs a change."
            action={
              <Button size="sm" onClick={() => setPage('browse')}>
                <Heart className="h-3.5 w-3.5" />
                Find wallpapers
              </Button>
            }
          />
        }
      />
    </div>
  )
}
