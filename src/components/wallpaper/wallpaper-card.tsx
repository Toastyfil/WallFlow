import { BookmarkPlus, Heart, Image as ImageIcon, Loader2, MonitorPlay, Play, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { useLibraryStore } from '@/store/useLibraryStore'
import { useUiStore } from '@/store/useUiStore'
import { toast } from '@/store/useToastStore'
import { cn } from '@/utils/cn'
import { resolutionLabel } from '@/utils/format'
import { useApplyWallpaper } from '@/utils/useApplyWallpaper'
import type { Wallpaper } from '@/types/wallpaper'

interface WallpaperCardProps {
  wallpaper: Wallpaper
  onRemove?: (wallpaper: Wallpaper) => void
}

export function WallpaperCard({ wallpaper, onRemove }: WallpaperCardProps) {
  const openPreview = useUiStore((state) => state.openPreview)
  const setSaveTarget = useUiStore((state) => state.setSaveTarget)
  const favorite = useLibraryStore((state) => state.favoriteIds.includes(wallpaper.id))
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite)
  const { apply, applyingId } = useApplyWallpaper()
  const applying = applyingId === wallpaper.id

  const handleFavorite = async (event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      const added = await toggleFavorite(wallpaper)
      toast({
        title: added ? 'Added to favorites' : 'Removed from favorites',
        description: wallpaper.title,
        variant: added ? 'success' : 'info',
      })
    } catch {
      toast({ title: 'Could not update favorites', variant: 'error' })
    }
  }

  return (
    <article className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-card shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-white/[0.13] hover:shadow-lift">
      <div className="relative aspect-[16/10] overflow-hidden" style={{ backgroundColor: wallpaper.color ?? '#0f0f18' }}>
        {wallpaper.thumbUrl ? (
          <img
            src={wallpaper.thumbUrl}
            alt={wallpaper.title}
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-accent/[0.14]">
            <ImageIcon className="h-6 w-6 text-white/25" />
          </div>
        )}

        <button
          type="button"
          onClick={() => openPreview(wallpaper)}
          className="absolute inset-0 z-10 cursor-zoom-in focus:outline-none"
          aria-label={`Preview ${wallpaper.title}`}
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent opacity-0 transition-opacity duration-150 group-hover:opacity-100" />

        {wallpaper.kind === 'video' || onRemove ? (
          <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
            {wallpaper.kind === 'video' ? (
              <Badge className="border-white/15 bg-black/60 text-white">
                <Play className="h-2.5 w-2.5 fill-current" /> Video
              </Badge>
            ) : null}
            {onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(wallpaper)}
                className="rounded-md border border-white/10 bg-black/55 p-1 text-white/70 opacity-0 backdrop-blur transition-all duration-150 hover:border-red-400/30 hover:bg-red-500/25 hover:text-white group-hover:opacity-100"
                aria-label="Remove from collection"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleFavorite}
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          className={cn(
            'absolute left-2 top-2 z-20 rounded-md border border-white/10 bg-black/50 p-1 backdrop-blur transition-all duration-150',
            favorite
              ? 'text-rose-400 opacity-100'
              : 'text-white/70 opacity-0 hover:text-rose-300 group-hover:opacity-100',
          )}
        >
          <Heart className={cn('h-3.5 w-3.5', favorite && 'fill-current')} />
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 translate-y-1 p-3 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
          <p className="line-clamp-1 text-[12px] font-medium text-white">{wallpaper.title}</p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="line-clamp-1 text-[11px] text-white/55">
              {wallpaper.author ? `${wallpaper.author} · ` : ''}
              {resolutionLabel(wallpaper.height)}
            </p>
            <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
              <Tooltip label="Save to collection">
                <Button
                  size="icon-sm"
                  variant="secondary"
                  className="border-white/15 bg-black/45 backdrop-blur hover:bg-black/60"
                  onClick={() => setSaveTarget(wallpaper)}
                  aria-label="Save to collection"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                </Button>
              </Tooltip>
              <Button
                size="sm"
                className="h-7 px-2.5 text-[11px]"
                onClick={() => apply(wallpaper)}
                disabled={applying}
              >
                {applying ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <MonitorPlay className="h-3 w-3" />
                )}
                Apply
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
