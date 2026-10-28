// Production build of the Electron main + preload bundles.
import { build } from 'esbuild'
import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'dist-electron')

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  minify: true,
  sourcemap: false,
  logLevel: 'info',
  external: ['electron', 'better-sqlite3', 'axios'],
  define: { 'process.env.NODE_ENV': '"production"' },
}

await build({
  ...shared,
  entryPoints: [path.join(root, 'electron/main.ts')],
  outfile: path.join(outDir, 'main.js'),
})

await build({
  ...shared,
  entryPoints: [path.join(root, 'electron/preload.ts')],
  outfile: path.join(outDir, 'preload.js'),
})

// The video-wallpaper player page is loaded by a hidden BrowserWindow.
await cp(path.join(root, 'electron/wallpaper/video.html'), path.join(outDir, 'video.html'))

console.log('Electron bundles written to dist-electron/')
