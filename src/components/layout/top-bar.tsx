import { useEffect, useRef, useState } from 'react'
import { Search, Timer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBrowseStore } from '@/store/useBrowseStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useUiStore } from '@/store/useUiStore'
import { formatInterval } from '@/utils/format'

export function TopBar() {
  const query = useBrowseStore((state) => state.query)
  const search = useBrowseStore((state) => state.search)
  const setPage = useUiStore((state) => state.setPage)
  const rotation = useSettingsStore((state) => state.settings?.rotation)
  const [value, setValue] = useState(query)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(query)
  }, [query])

  useEffect(() => {
    if (value === query) return
    const timer = setTimeout(() => {
      setPage('browse')
      void search(value)
    }, 420)
    return () => clearTimeout(timer)
  }, [value, query, search, setPage])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <header className="drag-region sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-hairline bg-base/85 pl-4 pr-[148px] backdrop-blur-md">
      <div className="no-drag relative w-full max-w-[360px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              setPage('browse')
              void search(value)
            }
          }}
          placeholder="Search wallpapers"
          aria-label="Search wallpapers"
          className="h-8 w-full rounded-md border border-hairline bg-white/[0.03] pl-8 pr-16 text-[12px] text-white/90 placeholder:text-subtle transition-colors duration-150 focus:border-white/20 focus:bg-white/[0.05] focus:outline-none"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue('')
              inputRef.current?.focus()
            }}
            className="absolute right-10 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/30 transition-colors duration-150 hover:text-white/70"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-hairline px-1 py-0.5 text-[9px] font-medium text-subtle">
          Ctrl K
        </kbd>
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="no-drag shrink-0"
        onClick={() => {
          setPage('browse')
          void search(value)
        }}
      >
        <Search className="h-3 w-3" />
        Search
      </Button>

      <div className="no-drag ml-auto flex items-center gap-2">
        {rotation?.enabled ? (
          <div className="flex items-center gap-1.5 text-[10.5px] text-white/40">
            <Timer className="h-3 w-3" />
            {formatInterval(rotation.intervalMinutes)}
          </div>
        ) : null}
      </div>
    </header>
  )
}
