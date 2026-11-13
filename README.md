# WallFlow

A small, fast Windows wallpaper browser — search a million-plus wallpapers, preview them full screen, and set them on your desktop in one click.

Built with Electron + React + Tailwind, packaged with electron-builder.

![Explore](screenshots/explore-top.jpg)

## Features

- **Browse & search** — responsive grid, keyword search, categories and orientation filters
- **Merged sources** — Wallhaven, Wikimedia, Konachan, Safebooru, DeviantArt, Bing's daily picks and your own feeds are searched together and streamed into one feed as each answers
- **Preview** — full-screen preview with resolution/author metadata before you commit
- **Apply** — downloads the full-resolution image and sets it as the real Windows wallpaper
- **Video wallpapers** — MP4/WebM loops play in a borderless, click-through window over the desktop
- **Favorites & collections** — saved locally in SQLite
- **Auto-rotate** — cycle a collection or your favorites every 5–240 minutes
- **Display resolution** — list the modes your monitor reports and switch resolution from the app
- **Themes** — six dark palettes (Midnight, Slate, Graphite, Plum, Moss, Ember) that also recolour the native title bar
- **Custom sources** — add RSS feeds or a direct image/video URL

## Where the wallpapers come from

Everything is browsable **without accounts or API keys**:

| Source | Catalog | Notes |
| --- | --- | --- |
| [Wallhaven](https://wallhaven.cc) | 1M+ | Curated desktop wallpapers, SFW only (`purity=100`), on by default |
| [Wikimedia Commons](https://commons.wikimedia.org) | 100M+ | Freely licensed photography and art, on by default |
| [Konachan](https://konachan.net) | 1M+ | Anime, game art and illustrations, SFW only (`rating:safe`), on by default |
| [Safebooru](https://safebooru.org) | 5M+ | Anime & game fan art, SFW-only board, on by default |
| [DeviantArt](https://www.deviantart.com) | 500M+ | Fan art & digital art, adult submissions dropped (previews cap near 1200px), on by default |
| [Bing daily](https://www.bing.com) | 8 | One curated 4K landscape a day, last eight kept, on by default |
| [Openverse](https://openverse.org) | 900M+ | CC-licensed photos from Flickr, museums and more (see limits below) |
| Your feeds | — | RSS feeds and direct image/video links |

Every enabled catalog is queried together and the results are interleaved, so there is no per-source
filter in the browser — switch catalogs off entirely in **Settings → Sources** if you want a narrower
feed. Konachan, Safebooru, DeviantArt and Bing are on by default, and existing installs pick them up
automatically on first launch. Openverse is off by default because [its anonymous
tier](https://api.openverse.org/v1/) allows only 20 results per page and roughly 200 requests a day.

Earlier drafts also listed Unsplash, Pexels and Pixabay. Pexels and Pixabay require a personal
API key for every user, and Unsplash's keyless `napi` endpoint is bot-gated (401), so the app ships
with keyless catalogs only. Adding a keyed source is one file in `src/services/` plus one entry in
`src/types/wallpaper.ts` and the client registry in `src/services/index.ts`.

## Requirements

- Windows 10/11 (x64)
- Node.js 20+ (developed on Node 24)

## Commands

```bash
npm install       # install dependencies
npm run dev       # Vite + Electron with hot reload
npm run build     # build the renderer + main process, then package dist/WallFlow-<version>-setup.exe
npm run typecheck # renderer and main-process TypeScript checks
npm run icon      # regenerate build/icon.png and build/icon.ico
```

`npm run build` writes the NSIS installer to `dist/`. It is a per-user install with a desktop
shortcut. The clean, ready-to-ship copy of the installer lives in `installer/` (only the `.exe`,
nothing else).

## Project structure

```
src/
  components/
    layout/        sidebar, top bar
    wallpaper/     card, grid, preview dialog, save dialog
    collections/   collection card
    settings/      add-source dialog
    ui/            button, input, dialog, select, switch, slider, toast, …
  pages/           browse, collections, favorites, settings
  services/        source clients (wallhaven, commons, bing, konachan, safebooru, deviantart, openverse, custom) — main process only
  store/           zustand stores (browse, library, settings, ui, toasts)
  types/           wallpaper + IPC contracts
  utils/           cn, formatters, apply hook, theme palettes
electron/
  main.ts          app lifecycle and window
  preload.ts       context-isolated `window.wallflow` bridge
  ipc.ts           IPC handlers
  store/           SQLite store with JSON fallback
  wallpaper/       Win32 apply, video window, player page, shared service
  display/         display-mode enumeration and ChangeDisplaySettings
  utils/           media cache downloads
  rotation.ts      auto-rotate scheduler
scripts/           dev runner, esbuild build, icon generator
```

## How it works

- **Fetching happens in the main process.** The renderer never touches remote APIs, so there are no
  CORS problems and the renderer's CSP can stay strict (`script-src 'self'`). Results stream back per
  catalog over `sources:partial`, so the grid paints in well under a second while slower sources keep
  loading; any single source that takes longer than 4 seconds is skipped for that page.
- **Applying images** uses `User32!SystemParametersInfo(SPI_SETDESKWALLPAPER)` through PowerShell and
  sets the wallpaper style to "Fill". That is the same Win32 mechanism the `wallpaper` npm package
  uses, but without a native addon to rebuild or bundle.
- **Applying videos** downloads the loop into the app cache and plays it in a frameless
  `BrowserWindow` pinned to the work area with `setIgnoreMouseEvents(true)` and
  `setAlwaysOnTop(false)`. A still frame is set as the actual desktop wallpaper first.
  *Limitation:* the window sits above the desktop icons and below normal windows. Truly rendering
  behind the icons requires parenting to Explorer's `WorkerW` window in native code.
- **Storage** lives in `%APPDATA%/WallFlow`: `wallflow.db` (better-sqlite3, N-API prebuild) with an
  automatic JSON fallback at `wallflow-data.json` if the native module can't load. Downloaded media
  goes to `wallpaper-cache/`.

## Notes

- Every catalog is filtered to safe content: Wallhaven uses `purity=100`, Konachan uses
  `rating:safe`, Safebooru is an SFW-only board, DeviantArt's adult-rated deviations are dropped, and
  Openverse sends `mature=false`. Wikimedia queries are restricted to bitmap files at least 1600 px
  wide.
- Images are only shown when they are big enough to be a wallpaper: Wallhaven asks for 1920×1080+,
  the boorus drop anything under 1600 px wide, and Bing serves its 4K UHD file.
- The app is single-instance and remembers the last applied wallpaper ("Applied 2m ago" in the
  sidebar).
- `Ctrl K` focuses the search box, `Esc` closes the preview.
