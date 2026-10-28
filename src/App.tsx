import { useEffect } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/top-bar'
import { SaveToCollectionDialog } from '@/components/wallpaper/save-to-collection-dialog'
import { WallpaperPreview } from '@/components/wallpaper/wallpaper-preview'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BrowsePage } from '@/pages/browse'
import { CollectionsPage } from '@/pages/collections'
import { FavoritesPage } from '@/pages/favorites'
import { SettingsPage } from '@/pages/settings'
import { useLibraryStore } from '@/store/useLibraryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useUiStore } from '@/store/useUiStore'

export default function App() {
  const page = useUiStore((state) => state.page)
  const setActive = useUiStore((state) => state.setActive)
  const loadSettings = useSettingsStore((state) => state.load)
  const loadLibrary = useLibraryStore((state) => state.loadAll)

  useEffect(() => {
    void loadSettings()
    void loadLibrary()

    void window.wallflow.wallpaper.active().then(setActive).catch(() => undefined)
    const unsubscribe = window.wallflow.wallpaper.onChanged(setActive)
    return unsubscribe
  }, [loadSettings, loadLibrary, setActive])

  return (
    <TooltipProvider delayDuration={350}>
      <div className="flex h-screen overflow-hidden bg-base">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1680px] px-5 py-5">
              {page === 'browse' ? <BrowsePage /> : null}
              {page === 'collections' ? <CollectionsPage /> : null}
              {page === 'favorites' ? <FavoritesPage /> : null}
              {page === 'settings' ? <SettingsPage /> : null}
            </div>
          </main>
        </div>

        <WallpaperPreview />
        <SaveToCollectionDialog />
        <Toaster />
      </div>
    </TooltipProvider>
  )
}
