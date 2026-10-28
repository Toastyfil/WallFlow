import { useEffect, useState } from 'react'
import { Link2, Loader2, Rss } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useLibraryStore } from '@/store/useLibraryStore'
import { toast } from '@/store/useToastStore'
import { cn } from '@/utils/cn'

interface AddSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddSourceDialog({ open, onOpenChange }: AddSourceDialogProps) {
  const addCustomSource = useLibraryStore((state) => state.addCustomSource)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [kind, setKind] = useState<'rss' | 'direct'>('rss')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setName('')
      setUrl('')
      setKind('rss')
      setBusy(false)
    }
  }, [open])

  const submit = async () => {
    if (!name.trim() || !url.trim()) return
    setBusy(true)
    try {
      await addCustomSource({ name: name.trim(), url: url.trim(), kind })
      toast({ title: 'Source added', description: name.trim(), variant: 'success' })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'Could not add source',
        description: error instanceof Error ? error.message : 'Check the URL and try again',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a custom source</DialogTitle>
          <DialogDescription>
            Point WallFlow at an RSS feed of images or a direct media URL.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: 'rss', label: 'RSS feed', icon: Rss },
                { value: 'direct', label: 'Direct link', icon: Link2 },
              ] as const
            ).map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setKind(option.value)}
                  className={cn(
                    'flex h-9 items-center justify-center gap-2 rounded-lg border text-[12px] transition-all duration-150',
                    kind === option.value
                      ? 'border-accent/40 bg-accent/12 text-white'
                      : 'border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/15 hover:text-white/80',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {option.label}
                </button>
              )
            })}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="source-name" className="text-[11.5px] font-medium text-white/60">
              Name
            </label>
            <Input
              id="source-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My wallpaper feed"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="source-url" className="text-[11.5px] font-medium text-white/60">
              {kind === 'rss' ? 'Feed URL' : 'Media URL'}
            </label>
            <Input
              id="source-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submit()
              }}
              placeholder={kind === 'rss' ? 'https://example.com/wallpapers.rss' : 'https://example.com/photo.jpg'}
            />
            <p className="text-[11px] leading-relaxed text-subtle">
              {kind === 'rss'
                ? 'Images are read from enclosures, media thumbnails and image links in each item.'
                : 'Supports JPG, PNG, WebP, AVIF, MP4 and WebM.'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || !url.trim() || busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Add source
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
