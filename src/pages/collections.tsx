import { useEffect, useState } from 'react'
import { ChevronLeft, FolderPlus, Loader2, Plus, Timer, Trash2 } from 'lucide-react'
import { CollectionCard } from '@/components/collections/collection-card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { WallpaperGrid } from '@/components/wallpaper/wallpaper-grid'
import { useLibraryStore } from '@/store/useLibraryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useUiStore } from '@/store/useUiStore'
import { toast } from '@/store/useToastStore'
import { cn } from '@/utils/cn'
import { formatInterval } from '@/utils/format'
import type { Collection, Wallpaper } from '@/types/wallpaper'

export function CollectionsPage() {
  const collections = useLibraryStore((state) => state.collections)
  const loading = useLibraryStore((state) => state.loading)
  const createCollection = useLibraryStore((state) => state.createCollection)
  const renameCollection = useLibraryStore((state) => state.renameCollection)
  const deleteCollection = useLibraryStore((state) => state.deleteCollection)
  const removeCollectionItem = useLibraryStore((state) => state.removeCollectionItem)
  const settings = useSettingsStore((state) => state.settings)
  const updateSettings = useSettingsStore((state) => state.update)
  const setPage = useUiStore((state) => state.setPage)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [items, setItems] = useState<Wallpaper[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Collection | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const selected = collections.find((collection) => collection.id === selectedId) ?? null
  const rotationOn = Boolean(
    selected && settings?.rotation.enabled && settings.rotation.collectionId === selected.id,
  )

  useEffect(() => {
    if (!selectedId) {
      setItems([])
      return
    }
    let active = true
    window.wallflow.collections
      .items(selectedId)
      .then((list) => {
        if (active) setItems(list)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [selectedId, refreshKey, collections])

  const handleRemoveItem = async (wallpaper: Wallpaper) => {
    if (!selectedId) return
    try {
      await removeCollectionItem(selectedId, wallpaper.id)
      setRefreshKey((key) => key + 1)
      toast({ title: 'Removed from collection', description: wallpaper.title, variant: 'info' })
    } catch {
      toast({ title: 'Could not remove wallpaper', variant: 'error' })
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const created = await createCollection(name.trim())
      setName('')
      setCreateOpen(false)
      if (created) setSelectedId(created.id)
      toast({ title: 'Collection created', description: name.trim(), variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not create collection',
        description: error instanceof Error ? error.message : undefined,
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const handleRename = async () => {
    if (!renameTarget || !name.trim()) return
    setBusy(true)
    try {
      await renameCollection(renameTarget.id, name.trim())
      toast({ title: 'Collection renamed', variant: 'success' })
      setRenameTarget(null)
      setName('')
    } catch (error) {
      toast({
        title: 'Could not rename collection',
        description: error instanceof Error ? error.message : undefined,
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await deleteCollection(deleteTarget.id)
      if (selectedId === deleteTarget.id) setSelectedId(null)
      toast({ title: 'Collection deleted', description: deleteTarget.name, variant: 'info' })
      setDeleteTarget(null)
    } catch (error) {
      toast({
        title: 'Could not delete collection',
        description: error instanceof Error ? error.message : undefined,
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const toggleRotation = async () => {
    if (!selected) return
    const next = !rotationOn
    await updateSettings({ rotation: { enabled: next, collectionId: selected.id } })
    toast({
      title: next ? 'Auto-rotate enabled' : 'Auto-rotate paused',
      description: next ? `Cycling “${selected.name}” every ${formatInterval(settings?.rotation.intervalMinutes ?? 30)}` : undefined,
      variant: 'success',
    })
  }

  // ---------- collection detail ----------
  if (selected) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-1 text-[12px] text-white/50 transition-colors duration-150 hover:text-white/80"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All collections
        </button>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-[18px] font-semibold tracking-tight text-white">{selected.name}</h1>
            <p className="mt-1 text-[12.5px] text-muted">
              {items.length} wallpaper{items.length === 1 ? '' : 's'}
              {rotationOn ? ' · auto-rotating' : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={rotationOn ? 'default' : 'secondary'}
              size="sm"
              onClick={toggleRotation}
              className={cn(rotationOn && 'shadow-none')}
            >
              <Timer className="h-3.5 w-3.5" />
              {rotationOn ? 'Stop rotating' : 'Auto-rotate'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteTarget(selected)}
              aria-label="Delete collection"
              className="text-white/45 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <WallpaperGrid
          wallpapers={items}
          onRemove={handleRemoveItem}
          empty={
            <EmptyState
              illustration="collection"
              title="This collection is empty"
              description="Browse wallpapers and hit the save button on any card to drop it in here."
              action={
                <Button size="sm" onClick={() => setPage('browse')}>
                  Browse wallpapers
                </Button>
              }
            />
          }
        />

        <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => (!open ? setDeleteTarget(null) : undefined)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete this collection?</DialogTitle>
              <DialogDescription>
                “{deleteTarget?.name}” and its saved wallpapers will be removed from WallFlow. Your desktop
                wallpaper stays as it is.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ---------- collections list ----------
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-white">Collections</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {collections.length > 0
              ? `${collections.length} collection${collections.length === 1 ? '' : 's'} ready to rotate`
              : 'Group wallpapers by mood and rotate them automatically'}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setName('')
            setCreateOpen(true)
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          New collection
        </Button>
      </div>

      {collections.length === 0 && !loading ? (
        <EmptyState
          illustration="collection"
          title="No collections yet"
          description="Collections keep your wallpapers organised — and they power auto-rotation. Create one to begin."
          action={
            <Button
              size="sm"
              onClick={() => {
                setName('')
                setCreateOpen(true)
              }}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Create a collection
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4">
          {collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onOpen={() => setSelectedId(collection.id)}
              onRename={() => {
                setName(collection.name)
                setRenameTarget(collection)
              }}
              onDelete={() => setDeleteTarget(collection)}
            />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New collection</DialogTitle>
            <DialogDescription>Give it a name that matches the vibe.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleCreate()
            }}
            placeholder="e.g. Midnight minimal"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null)
            setName('')
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename collection</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleRename()
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!name.trim() || busy}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => (!open ? setDeleteTarget(null) : undefined)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this collection?</DialogTitle>
            <DialogDescription>
              “{deleteTarget?.name}” and its saved wallpapers will be removed from WallFlow. Your desktop
              wallpaper stays as it is.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
