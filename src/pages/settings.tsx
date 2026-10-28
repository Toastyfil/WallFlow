import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { FolderOpen, Link2, Loader2, Plus, RotateCw, Rss, Trash2 } from 'lucide-react'
import { AddSourceDialog } from '@/components/settings/add-source-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useLibraryStore } from '@/store/useLibraryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { toast } from '@/store/useToastStore'
import { cn } from '@/utils/cn'
import { formatInterval, hostOf } from '@/utils/format'
import { SOURCE_META } from '@/types/wallpaper'
import type { AppInfo, BuiltInSourceId, MinResolution, Orientation, SourceId } from '@/types/wallpaper'
import type { DisplayInfo, DisplayMode } from '@/types/ipc'

const BUILT_IN_SOURCES: BuiltInSourceId[] = ['wallhaven', 'commons']

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string
  description?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="rounded-xl border border-hairline bg-card/40">
      <div className="flex items-start justify-between gap-4 border-b border-hairline px-4 py-3.5">
        <div>
          <h2 className="text-[12.5px] font-semibold text-white/90">{title}</h2>
          {description ? <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="px-4">{children}</div>
    </section>
  )
}

function Row({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-hairline py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-[12px] text-white/85">{title}</p>
        {description ? <p className="mt-0.5 text-[11px] leading-relaxed text-subtle">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SettingsPage() {
  const settings = useSettingsStore((state) => state.settings)
  const update = useSettingsStore((state) => state.update)
  const collections = useLibraryStore((state) => state.collections)
  const customSources = useLibraryStore((state) => state.customSources)
  const toggleCustomSource = useLibraryStore((state) => state.toggleCustomSource)
  const removeCustomSource = useLibraryStore((state) => state.removeCustomSource)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [interval, setInterval] = useState(30)
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo | null>(null)
  const [displayError, setDisplayError] = useState<string | null>(null)
  const [selectedDisplay, setSelectedDisplay] = useState('')
  const [displayBusy, setDisplayBusy] = useState(false)

  useEffect(() => {
    void window.wallflow.app.info().then(setInfo).catch(() => undefined)
  }, [])

  useEffect(() => {
    window.wallflow.display
      .info()
      .then((display) => {
        setDisplayInfo(display)
        setSelectedDisplay(`${display.current.width}x${display.current.height}`)
      })
      .catch((error: unknown) =>
        setDisplayError(error instanceof Error ? error.message : 'Display controls unavailable'),
      )
  }, [])

  useEffect(() => {
    if (settings) setInterval(settings.rotation.intervalMinutes)
  }, [settings])

  if (!settings) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const toggleSource = async (source: SourceId, enabled: boolean) => {
    const current = settings.enabledSources
    const next = enabled ? [...new Set([...current, source])] : current.filter((item) => item !== source)
    if (next.length === 0) {
      toast({ title: 'Keep at least one source enabled', variant: 'info' })
      return
    }
    await update({ enabledSources: next })
  }

  const commitInterval = async (minutes: number) => {
    const next = await update({ rotation: { intervalMinutes: minutes } })
    if (next) {
      toast({
        title: 'Rotation interval updated',
        description: `Wallpapers change every ${formatInterval(minutes)}`,
        variant: 'success',
      })
    }
  }

  const displayOptions: DisplayMode[] = (() => {
    if (!displayInfo) return []
    const unique = new Map<string, DisplayMode>()
    for (const mode of displayInfo.modes) {
      const key = `${mode.width}x${mode.height}`
      const existing = unique.get(key)
      if (!existing || mode.refresh > existing.refresh) unique.set(key, mode)
    }
    return [...unique.values()].sort((a, b) => b.width * b.height - a.width * a.height)
  })()

  const applyDisplay = async () => {
    const mode = displayOptions.find((option) => `${option.width}x${option.height}` === selectedDisplay)
    if (!mode) return
    setDisplayBusy(true)
    try {
      const result = await window.wallflow.display.set(mode)
      toast({
        title: result.ok ? 'Display updated' : 'Could not change display',
        description: result.message,
        variant: result.ok ? 'success' : 'error',
      })
      if (result.ok) {
        const next = await window.wallflow.display.info()
        setDisplayInfo(next)
      }
    } catch (error) {
      toast({
        title: 'Could not change display',
        description: error instanceof Error ? error.message : undefined,
        variant: 'error',
      })
    } finally {
      setDisplayBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3 pb-8">
      <div className="mb-4">
        <h1 className="text-[18px] font-semibold tracking-tight text-white">Settings</h1>
        <p className="mt-0.5 text-[12px] text-muted">Sources, quality and automation. Everything stays on this device.</p>
      </div>

      <Section title="Sources" description="No accounts, no keys. Toggle the catalogs you want to browse.">
        {BUILT_IN_SOURCES.map((source) => {
          const meta = SOURCE_META[source]
          return (
            <div key={source} className="flex items-center justify-between gap-4 border-b border-hairline py-3 last:border-0">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[12px] text-white/85">
                  {meta.label}
                  <Badge className="border-hairline bg-white/[0.03] normal-case tracking-normal text-[9.5px] text-white/50">
                    {meta.catalog} wallpapers
                  </Badge>
                </p>
                <p className="mt-0.5 text-[11px] text-subtle">{meta.blurb}</p>
              </div>
              <Switch
                checked={settings.enabledSources.includes(source)}
                onCheckedChange={(checked) => toggleSource(source, checked)}
              />
            </div>
          )
        })}
      </Section>

      <Section title="Browsing" description="Defaults for search results and applied wallpapers.">
        <Row title="Orientation" description="Filter results by shape.">
          <Select
            value={settings.orientation}
            onValueChange={(value) => void update({ orientation: value as Orientation })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="landscape">Landscape</SelectItem>
              <SelectItem value="portrait">Portrait</SelectItem>
              <SelectItem value="square">Square</SelectItem>
            </SelectContent>
          </Select>
        </Row>

        <Row title="Minimum resolution" description="Hide results below this size.">
          <Select
            value={settings.minResolution}
            onValueChange={(value) => void update({ minResolution: value as MinResolution })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any size</SelectItem>
              <SelectItem value="1080p">1080p+</SelectItem>
              <SelectItem value="1440p">1440p+</SelectItem>
              <SelectItem value="4k">4K only</SelectItem>
            </SelectContent>
          </Select>
        </Row>

        <Row title="Mute video wallpapers" description="Looping videos play without sound.">
          <Switch checked={settings.videoMuted} onCheckedChange={(checked) => void update({ videoMuted: checked })} />
        </Row>
      </Section>

      <Section
        title="Display"
        description="Change the resolution of your main screen. This affects the whole system."
      >
        {displayError ? (
          <Row title="Resolution" description={displayError}>
            <span className="text-[11.5px] text-subtle">Unavailable</span>
          </Row>
        ) : (
          <>
            <Row
              title="Current"
              description={displayInfo ? `${displayInfo.current.refresh} Hz` : undefined}
            >
              <span className="text-[11.5px] tabular-nums text-white/60">
                {displayInfo ? `${displayInfo.current.width} × ${displayInfo.current.height}` : '—'}
              </span>
            </Row>
            <Row title="Set resolution" description="Only modes reported by your display are listed.">
              <div className="flex items-center gap-2">
                <Select value={selectedDisplay} onValueChange={setSelectedDisplay}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {displayOptions.map((option) => (
                      <SelectItem
                        key={`${option.width}x${option.height}`}
                        value={`${option.width}x${option.height}`}
                      >
                        {option.width} × {option.height}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="secondary" size="sm" onClick={applyDisplay} disabled={displayBusy || !selectedDisplay}>
                  {displayBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Apply
                </Button>
              </div>
            </Row>
          </>
        )}
      </Section>

      <Section
        title="Auto-rotate"
        description="Cycle a collection or your favorites on a timer."
        action={
          <Switch
            checked={settings.rotation.enabled}
            onCheckedChange={async (checked) => {
              await update({ rotation: { enabled: checked } })
              await window.wallflow.rotation.sync()
              toast({ title: checked ? 'Auto-rotate started' : 'Auto-rotate paused', variant: 'info' })
            }}
          />
        }
      >
        <div className={cn('transition-opacity duration-150', !settings.rotation.enabled && 'pointer-events-none opacity-40')}>
          <div className="border-b border-hairline py-3.5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[12px] text-white/85">Change every</p>
                <p className="mt-0.5 text-[11px] text-subtle">Between 5 minutes and 4 hours.</p>
              </div>
              <span className="rounded border border-hairline bg-white/[0.03] px-2 py-0.5 text-[11px] tabular-nums text-white/70">
                {formatInterval(interval)}
              </span>
            </div>
            <Slider
              value={[interval]}
              min={5}
              max={240}
              step={5}
              onValueChange={(value) => setInterval(value[0])}
              onValueCommit={(value) => void commitInterval(value[0])}
            />
          </div>

          <Row title="Source" description="Favorites are used when nothing is selected.">
            <Select
              value={settings.rotation.collectionId ?? 'favorites'}
              onValueChange={(value) =>
                void update({ rotation: { collectionId: value === 'favorites' ? null : value } })
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="favorites">Favorites</SelectItem>
                {collections.map((collection) => (
                  <SelectItem key={collection.id} value={collection.id}>
                    {collection.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>

          <Row title="Shuffle" description="Random order instead of sequential.">
            <Switch
              checked={settings.rotation.shuffle}
              onCheckedChange={(checked) => void update({ rotation: { shuffle: checked } })}
            />
          </Row>
        </div>
      </Section>

      <Section
        title="Your feeds"
        description="RSS feeds and direct links, searched alongside the catalogs."
        action={
          <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        }
      >
        {customSources.length === 0 ? (
          <div className="flex items-center justify-between gap-4 py-4">
            <p className="text-[11.5px] text-subtle">
              Add a feed of images, or link a single image or video file.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
              <Rss className="h-3.5 w-3.5" />
              Add feed
            </Button>
          </div>
        ) : (
          customSources.map((source) => {
            const Icon = source.kind === 'rss' ? Rss : Link2
            return (
              <div key={source.id} className="flex items-center gap-3 border-b border-hairline py-2.5 last:border-0">
                <Icon className="h-3.5 w-3.5 shrink-0 text-white/35" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] text-white/85">{source.name}</p>
                  <p className="truncate text-[11px] text-subtle">{hostOf(source.url)}</p>
                </div>
                <Switch
                  checked={source.enabled}
                  onCheckedChange={(checked) => void toggleCustomSource(source.id, checked)}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={async () => {
                    await removeCustomSource(source.id)
                    toast({ title: 'Feed removed', description: source.name, variant: 'info' })
                  }}
                  aria-label={`Remove ${source.name}`}
                  className="text-white/30 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          })
        )}
      </Section>

      <Section title="About">
        <Row title="Version" description={info ? `Electron ${info.electron} · ${info.platform}` : undefined}>
          <span className="text-[11.5px] text-white/60">v{info?.version ?? '1.0.0'}</span>
        </Row>
        <Row title="Library storage" description="Favorites, collections and settings.">
          <Badge className="border-hairline bg-white/[0.03] normal-case tracking-normal text-white/60">
            {info?.storage === 'sqlite' ? 'SQLite' : 'JSON file'}
          </Badge>
        </Row>
        <Row title="Wallpaper cache" description="Downloaded images and videos.">
          <Button variant="secondary" size="sm" onClick={() => void window.wallflow.app.openCacheFolder()}>
            <FolderOpen className="h-3.5 w-3.5" />
            Open
          </Button>
        </Row>
        <Row title="Rotation schedule" description="Restart the timer after editing collections.">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await window.wallflow.rotation.sync()
              toast({ title: 'Rotation schedule updated', variant: 'success' })
            }}
          >
            <RotateCw className="h-3.5 w-3.5" />
            Restart
          </Button>
        </Row>
      </Section>

      <AddSourceDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
