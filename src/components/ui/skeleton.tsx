import { cn } from '@/utils/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton-shine rounded-xl bg-white/[0.035]', className)} />
}
