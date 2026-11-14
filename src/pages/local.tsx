import { useEffect, useState } from 'react'
import { FolderOpen, Images, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WallpaperGrid } from '@/components/wallpaper/wallpaper-grid'
import { useToastStore } from '@/store/useToastStore'
import type { Wallpaper } from '@/types/wallpaper'

export function LocalPage() {
  const [items, setItems] = useState<Wallpaper[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const push = useToastStore((state) => state.push)

  useEffect(() => {
    let alive = true
    if (!window.wallflow.local) {
      setLoading(false)
      return
    }
    void window.wallflow.local
      .list()
      .then((list) => {
        if (alive) setItems(list)
      })
      .catch((error) => console.error('Failed to load local wallpapers', error))
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const runImport = async (mode: 'files' | 'folder') => {
    const local = window.wallflow.local
    if (!local) return
    setImporting(true)
    try {
      const result = mode === 'files' ? await local.addFiles() : await local.addFolder()
      if (!result) return
      setItems(result.items)
      push({
        title: result.added > 0 ? `Imported ${result.added}` : 'Nothing new to import',
        description:
          result.added > 0
            ? 'Your wallpapers are ready to apply.'
            : 'Those files are already in your library.',
        variant: result.added > 0 ? 'success' : 'info',
      })
    } catch (error) {
      console.error(error)
      push({ title: 'Import failed', description: 'Could not read those files.', variant: 'error' })
    } finally {
      setImporting(false)
    }
  }

  const remove = async (wallpaper: Wallpaper) => {
    if (!window.wallflow.local) return
    try {
      setItems(await window.wallflow.local.remove(wallpaper.id))
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-white">Local wallpapers</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {items.length > 0
              ? `${items.length} file${items.length === 1 ? '' : 's'} from your own disk`
              : 'Use the wallpapers you already have'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={importing} onClick={() => void runImport('files')}>
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Images className="h-3.5 w-3.5" />}
            Add images
          </Button>
          <Button size="sm" disabled={importing} onClick={() => void runImport('folder')}>
            <FolderOpen className="h-3.5 w-3.5" />
            Add folder
          </Button>
        </div>
      </div>

      <WallpaperGrid
        wallpapers={items}
        loading={loading}
        skeletonCount={8}
        onRemove={remove}
        empty={
          <div className="grid place-items-center rounded-xl border border-dashed border-hairline px-6 py-16 text-center">
            <div>
              <p className="text-[13px] font-medium text-white/85">No local wallpapers yet</p>
              <p className="mx-auto mt-1.5 max-w-[340px] text-[12px] text-muted">
                Add a few images, or point WallFlow at a folder — it scans subfolders too and keeps
                the list between launches.
              </p>
            </div>
          </div>
        }
      />
    </div>
  )
}
