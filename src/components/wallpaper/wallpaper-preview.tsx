import { useState } from 'react'
import {
  BookmarkPlus,
  ExternalLink,
  Heart,
  Loader2,
  MonitorPlay,
  Play,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tooltip } from '@/components/ui/tooltip'
import { useLibraryStore } from '@/store/useLibraryStore'
import { useUiStore } from '@/store/useUiStore'
import { toast } from '@/store/useToastStore'
import { cn } from '@/utils/cn'
import { formatResolution, resolutionLabel } from '@/utils/format'
import { useApplyWallpaper } from '@/utils/useApplyWallpaper'
import { SOURCE_META } from '@/types/wallpaper'

export function WallpaperPreview() {
  const preview = useUiStore((state) => state.preview)
  const open = useUiStore((state) => state.previewOpen)
  const closePreview = useUiStore((state) => state.closePreview)
  const setSaveTarget = useUiStore((state) => state.setSaveTarget)
  const favorite = useLibraryStore((state) =>
    preview ? state.favoriteIds.includes(preview.id) : false,
  )
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite)
  const { apply, applyingId } = useApplyWallpaper()
  const [mediaReady, setMediaReady] = useState(false)

  if (!preview) return null

  const applying = applyingId === preview.id
  const isVideo = preview.kind === 'video'

  const handleFavorite = async () => {
    try {
      const added = await toggleFavorite(preview)
      toast({
        title: added ? 'Added to favorites' : 'Removed from favorites',
        description: preview.title,
        variant: added ? 'success' : 'info',
      })
    } catch {
      toast({ title: 'Could not update favorites', variant: 'error' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? closePreview() : undefined)}>
      <DialogContent
        showClose={false}
        className="grid h-[min(720px,calc(100vh-112px))] w-[min(1200px,94vw)] max-w-none grid-cols-1 gap-0 overflow-hidden bg-surface p-0 md:grid-cols-[1fr_320px]"
      >
        <div className="relative flex items-center justify-center overflow-hidden bg-[#06060a]">
          {!mediaReady ? (
            <div className="absolute inset-0 animate-pulse bg-white/[0.02]" />
          ) : null}

          {isVideo && preview.videoUrl ? (
            <video
              key={preview.id}
              src={preview.videoUrl}
              poster={preview.previewUrl}
              autoPlay
              loop
              muted
              playsInline
              onLoadedData={() => setMediaReady(true)}
              className="h-full w-full object-contain"
            />
          ) : (
            <img
              key={preview.id}
              src={preview.previewUrl || preview.fullUrl}
              alt={preview.title}
              draggable={false}
              onLoad={() => setMediaReady(true)}
              className="h-full w-full object-contain"
            />
          )}

          <button
            type="button"
            onClick={closePreview}
            className="absolute left-3 top-3 z-10 rounded-full border border-white/10 bg-black/55 p-1.5 text-white/75 backdrop-blur transition-all duration-150 hover:bg-black/75 hover:text-white"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>

          {isVideo ? (
            <div className="pointer-events-none absolute bottom-3 left-3">
              <Badge className="border-white/15 bg-black/65 text-white">
                <Play className="h-2.5 w-2.5 fill-current" /> Muted preview
              </Badge>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col border-t border-hairline p-5 md:border-l md:border-t-0">
          <div className="mb-3 flex items-center gap-2">
            <Badge>{preview.sourceLabel ?? SOURCE_META[preview.source].label}</Badge>
            <Badge className="border-white/10 bg-white/[0.04] text-white/70">
              {resolutionLabel(preview.height)}
            </Badge>
            {isVideo ? (
              <Badge className="border-white/10 bg-white/[0.04] text-white/70">Video</Badge>
            ) : null}
          </div>

          <DialogTitle className="line-clamp-2 text-[17px] leading-snug">{preview.title}</DialogTitle>
          <DialogDescription className="mt-1">
            {preview.author ? `by ${preview.author}` : 'Unknown author'}
          </DialogDescription>

          <dl className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-4 text-[12px]">
            <div className="flex items-center justify-between">
              <dt className="text-subtle">Resolution</dt>
              <dd className="text-white/80">{formatResolution(preview.width, preview.height)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-subtle">Type</dt>
              <dd className="text-white/80">{isVideo ? 'Video loop' : 'Image'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-subtle">Source</dt>
              <dd className="text-white/80">{preview.sourceLabel ?? SOURCE_META[preview.source].label}</dd>
            </div>
          </dl>

          <div className="mt-auto space-y-2 pt-6">
            <Button className="w-full" onClick={() => apply(preview)} disabled={applying}>
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorPlay className="h-4 w-4" />}
              {applying ? 'Applying…' : 'Set as Wallpaper'}
            </Button>

            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <Button variant="secondary" onClick={() => setSaveTarget(preview)}>
                <BookmarkPlus className="h-4 w-4" />
                Save
              </Button>
              <Tooltip label={favorite ? 'Remove from favorites' : 'Add to favorites'}>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleFavorite}
                  aria-label="Toggle favorite"
                  className={cn('h-9 w-9', favorite && 'border-rose-500/25 bg-rose-500/10 text-rose-300')}
                >
                  <Heart className={cn('h-4 w-4', favorite && 'fill-current')} />
                </Button>
              </Tooltip>
              <Tooltip label="Open original">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9"
                  disabled={!preview.pageUrl}
                  onClick={() => preview.pageUrl && window.wallflow.app.openExternal(preview.pageUrl)}
                  aria-label="Open original"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Tooltip>
            </div>

            <p className="pt-1 text-center text-[11px] leading-relaxed text-subtle">
              {isVideo
                ? 'Video wallpapers play in a click-through window over your desktop.'
                : 'Images are downloaded at full resolution and fitted to your screen.'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
