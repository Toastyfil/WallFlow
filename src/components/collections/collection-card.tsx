import { Layers, Pencil, Trash2 } from 'lucide-react'
import type { KeyboardEvent, MouseEvent } from 'react'
import type { Collection } from '@/types/wallpaper'

interface CollectionCardProps {
  collection: Collection
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}

export function CollectionCard({ collection, onOpen, onRename, onDelete }: CollectionCardProps) {
  const stop = (event: MouseEvent, action: () => void) => {
    event.stopPropagation()
    action()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-white/[0.06] bg-card shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-white/[0.13] hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {collection.coverUrl ? (
          <img
            src={collection.coverUrl}
            alt=""
            draggable={false}
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-accent/[0.14]">
            <Layers className="h-6 w-6 text-white/25" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

        <div className="absolute right-2 top-2 flex translate-y-1 gap-1.5 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={(event) => stop(event, onRename)}
            className="rounded-md border border-white/10 bg-black/55 p-1.5 text-white/70 backdrop-blur transition-colors duration-150 hover:bg-black/75 hover:text-white"
            aria-label={`Rename ${collection.name}`}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(event) => stop(event, onDelete)}
            className="rounded-md border border-white/10 bg-black/55 p-1.5 text-white/70 backdrop-blur transition-colors duration-150 hover:border-red-400/30 hover:bg-red-500/25 hover:text-white"
            aria-label={`Delete ${collection.name}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3.5">
          <p className="line-clamp-1 text-[13px] font-medium text-white">{collection.name}</p>
          <p className="mt-0.5 text-[11px] text-white/55">
            {collection.itemCount} wallpaper{collection.itemCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>
    </div>
  )
}
