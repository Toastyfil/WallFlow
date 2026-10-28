import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
  className?: string
  illustration?: 'wallpapers' | 'search' | 'collection' | 'heart' | 'settings'
}

function Illustration({ variant }: { variant: NonNullable<EmptyStateProps['illustration']> }) {
  return (
    <svg width="104" height="88" viewBox="0 0 104 88" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`wf-empty-${variant}`} x1="8" y1="10" x2="96" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c3aed" stopOpacity="0.34" />
          <stop offset="1" stopColor="#3b82f6" stopOpacity="0.14" />
        </linearGradient>
      </defs>
      <rect x="6" y="14" width="66" height="48" rx="9" stroke={`url(#wf-empty-${variant})`} strokeWidth="1.3" opacity="0.55" />
      <rect x="20" y="26" width="70" height="50" rx="10" stroke="white" strokeOpacity="0.1" strokeWidth="1.2" />
      <rect x="20" y="26" width="70" height="50" rx="10" fill={`url(#wf-empty-${variant})`} fillOpacity="0.3" />
      <circle cx="38" cy="42" r="4.5" fill="white" fillOpacity="0.24" />
      <path d="M24 68l16-16 12 12 10-10 18 18" stroke="white" strokeOpacity="0.3" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function EmptyState({ title, description, action, className, illustration = 'wallpapers' }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.012] px-8 py-16 text-center',
        className,
      )}
    >
      <div className="mb-5 opacity-90">
        <Illustration variant={illustration} />
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight text-white/90">{title}</h3>
      <p className="mt-1.5 max-w-[380px] text-[12.5px] leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
