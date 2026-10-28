import { useEffect, useState } from 'react'
import { Check, FolderPlus, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useLibraryStore } from '@/store/useLibraryStore'
import { useUiStore } from '@/store/useUiStore'
import { toast } from '@/store/useToastStore'

export function SaveToCollectionDialog() {
  const target = useUiStore((state) => state.saveTarget)
  const setSaveTarget = useUiStore((state) => state.setSaveTarget)
  const collections = useLibraryStore((state) => state.collections)
  const addToCollection = useLibraryStore((state) => state.addToCollection)
  const createCollection = useLibraryStore((state) => state.createCollection)
  const [name, setName] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!target) {
      setName('')
      setBusyId(null)
    }
  }, [target])

  const handleAdd = async (collectionId: string) => {
    if (!target) return
    setBusyId(collectionId)
    try {
      await addToCollection(collectionId, target)
      toast({ title: 'Saved to collection', description: target.title, variant: 'success' })
      setSaveTarget(null)
    } catch (error) {
      toast({
        title: 'Could not save wallpaper',
        description: error instanceof Error ? error.message : undefined,
        variant: 'error',
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setCreating(true)
    try {
      const created = await createCollection(trimmed)
      if (created && target) await handleAdd(created.id)
      setName('')
    } catch (error) {
      toast({
        title: 'Could not create collection',
        description: error instanceof Error ? error.message : undefined,
        variant: 'error',
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => (!open ? setSaveTarget(null) : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save to collection</DialogTitle>
          <DialogDescription className="line-clamp-1">
            {target?.title ?? 'Choose where to keep this wallpaper.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[240px] space-y-1 overflow-y-auto pr-1">
          {collections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-[12px] text-muted">
              No collections yet — create your first one below.
            </div>
          ) : (
            collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                onClick={() => handleAdd(collection.id)}
                disabled={busyId !== null}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-white/[0.05] disabled:opacity-50"
              >
                <div className="h-9 w-12 shrink-0 overflow-hidden rounded-md border border-white/[0.06] bg-card">
                  {collection.coverUrl ? (
                    <img src={collection.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-accent/[0.14]">
                      <FolderPlus className="h-3.5 w-3.5 text-white/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] text-white/85">{collection.name}</p>
                  <p className="text-[11px] text-subtle">{collection.itemCount} wallpapers</p>
                </div>
                {busyId === collection.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                ) : (
                  <Check className="h-4 w-4 text-white/20" />
                )}
              </button>
            ))
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-4">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleCreate()
            }}
            placeholder="New collection name"
            className="h-9"
          />
          <Button onClick={handleCreate} disabled={!name.trim() || creating} size="md">
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
