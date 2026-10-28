import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 text-[13px] text-white/90 placeholder:text-subtle',
        'transition-all duration-150 focus:border-accent/50 focus:bg-white/[0.05] focus:outline-none focus:ring-4 focus:ring-accent/10',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)

Input.displayName = 'Input'
