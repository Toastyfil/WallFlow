import { useCallback, useState } from 'react'
import { toast } from '@/store/useToastStore'
import type { ApplyResult, Wallpaper } from '@/types/wallpaper'

export function useApplyWallpaper() {
  const [applyingId, setApplyingId] = useState<string | null>(null)

  const apply = useCallback(
    async (wallpaper: Wallpaper): Promise<ApplyResult> => {
      setApplyingId(wallpaper.id)
      try {
        const result = await window.wallflow.wallpaper.apply(wallpaper)
        if (result.ok) {
          toast({
            title: wallpaper.kind === 'video' ? 'Video wallpaper started' : 'Wallpaper applied',
            description: wallpaper.title,
            variant: 'success',
          })
        } else {
          toast({
            title: 'Could not set wallpaper',
            description: result.message,
            variant: 'error',
          })
        }
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error'
        toast({ title: 'Could not set wallpaper', description: message, variant: 'error' })
        return { ok: false, message }
      } finally {
        setApplyingId(null)
      }
    },
    [],
  )

  return { applyingId, apply }
}
