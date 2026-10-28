// Starts Vite, builds the Electron main/preload bundles, then launches Electron.
// Main-process edits trigger an automatic Electron restart; renderer edits hot-reload.
import { createServer } from 'vite'
import { context } from 'esbuild'
import { spawn } from 'node:child_process'
import { mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electronBinary from 'electron'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'dist-electron')

await mkdir(outDir, { recursive: true })
await copyFile(path.join(root, 'electron/wallpaper/video.html'), path.join(outDir, 'video.html'))

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'warning',
  external: ['electron', 'better-sqlite3', 'axios'],
  define: { 'process.env.NODE_ENV': '"development"' },
}

let child = null
let restartTimer = null

function restartElectron(devUrl) {
  clearTimeout(restartTimer)
  restartTimer = setTimeout(() => {
    if (child) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
        } else {
          child.kill('SIGTERM')
        }
      } catch {
        /* already gone */
      }
      child = null
    }

    child = spawn(electronBinary, [root], {
      cwd: root,
      env: { ...process.env, NODE_ENV: 'development', VITE_DEV_SERVER_URL: devUrl },
      stdio: 'inherit',
    })
    child.on('close', (code) => {
      if (code !== null && code !== 0) console.log(`[electron] exited with code ${code}`)
    })
  }, 250)
}

const server = await createServer({ configFile: path.join(root, 'vite.config.ts') })
await server.listen()
const devUrl = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5199/'
server.printUrls()

const restartPlugin = {
  name: 'restart-electron',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length === 0) restartElectron(devUrl)
    })
  },
}

const mainCtx = await context({
  ...shared,
  entryPoints: [path.join(root, 'electron/main.ts')],
  outfile: path.join(outDir, 'main.js'),
  plugins: [restartPlugin],
})

const preloadCtx = await context({
  ...shared,
  entryPoints: [path.join(root, 'electron/preload.ts')],
  outfile: path.join(outDir, 'preload.js'),
})

await mainCtx.watch()
await preloadCtx.watch()

console.log('\n  WallFlow dev server ready — Electron is starting…\n')

async function shutdown() {
  if (child) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
      } else {
        child.kill('SIGTERM')
      }
    } catch {
      /* ignore */
    }
  }
  await mainCtx.dispose()
  await preloadCtx.dispose()
  await server.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.on('exit', () => {
  if (child) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
    } catch {
      /* ignore */
    }
  }
})
