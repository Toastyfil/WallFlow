import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { WallpaperCard } from './wallpaper-card'
import type { Wallpaper } from '@/types/wallpaper'

interface WallpaperGridProps {
  wallpapers: Wallpaper[]
  loading?: boolean
  skeletonCount?: number
  empty?: ReactNode
  onRemove?: (wallpaper: Wallpaper) => void
}

export function WallpaperGrid({
  wallpapers,
  loading = false,
  skeletonCount = 12,
  empty,
  onRemove,
}: WallpaperGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <Skeleton key={index} className="aspect-[16/10] rounded-xl" />
        ))}
      </div>
    )
  }

  if (wallpapers.length === 0) {
    return <>{empty}</>
  }

  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {wallpapers.map((wallpaper) => (
        <WallpaperCard key={wallpaper.id} wallpaper={wallpaper} onRemove={onRemove} />
      ))}
    </div>
  )
}
