import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/45 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-white/80 backdrop-blur-md',
        className,
      )}
      {...props}
    />
  )
}
