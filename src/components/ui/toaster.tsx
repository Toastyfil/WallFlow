import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useToastStore } from '@/store/useToastStore'
import type { ToastVariant } from '@/store/useToastStore'
import { cn } from '@/utils/cn'

const ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const ACCENTS: Record<ToastVariant, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-sky-400',
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[320px] flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.variant]
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex animate-slide-in-right items-start gap-2.5 rounded-xl border border-white/[0.08] bg-elevated/95 px-3.5 py-3 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl"
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ACCENTS[toast.variant])} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-white/95">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{toast.description}</p>
              ) : null}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="rounded p-0.5 text-white/30 transition-colors duration-150 hover:text-white/70"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
