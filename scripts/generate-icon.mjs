// Generates the WallFlow app icon (a minimal wallpaper mark) without image dependencies.
// Emits build/icon.png (512px) and build/icon.ico (16-256px, PNG-compressed entries).
import { mkdir, writeFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'build')

const SS = 1024 // supersampled render size
const SIZE = 512 // exported PNG size

const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v))
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}
const lerp = (a, b, t) => a + (b - a) * t

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = clamp(t)
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function sdfRoundRect(x, y, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(x - cx) - halfW + radius
  const qy = Math.abs(y - cy) - halfH + radius
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
}

function squircleCoverage(x, y, radius = 0.22) {
  return 1 - smoothstep(-0.0025, 0.0025, sdfRoundRect(x, y, 0.5, 0.5, 0.5, 0.5, radius))
}

// ---------- background + glyph ----------
const bgTop = [24, 24, 28]
const bgBottom = [13, 13, 16]
const glyph = [236, 236, 242]

const FRAME = { cx: 0.5, cy: 0.5, hw: 0.265, hh: 0.195, radius: 0.05, stroke: 0.026 }
const SUN = { cx: 0.4, cy: 0.435, r: 0.036 }
const RIDGE = [
  [0.29, 0.62],
  [0.42, 0.5],
  [0.51, 0.58],
  [0.6, 0.51],
  [0.71, 0.62],
]
const RIDGE_STROKE = 0.028

const hi = Buffer.alloc(SS * SS * 4)

for (let y = 0; y < SS; y++) {
  for (let x = 0; x < SS; x++) {
    const u = (x + 0.5) / SS
    const v = (y + 0.5) / SS
    const i = (y * SS + x) * 4

    // flat, slightly lifted dark surface
    const t = clamp(v * 0.9 + u * 0.1)
    let r = lerp(bgTop[0], bgBottom[0], t)
    let g = lerp(bgTop[1], bgBottom[1], t)
    let b = lerp(bgTop[2], bgBottom[2], t)

    // faint sheen in the upper-left keeps it from looking flat-print
    const sheen = Math.max(0, 1 - Math.hypot(u - 0.2, v - 0.12) * 2.1) * 0.05
    r += (255 - r) * sheen
    g += (255 - g) * sheen
    b += (255 - b) * sheen

    // rounded frame
    const frameDist = Math.abs(sdfRoundRect(u, v, FRAME.cx, FRAME.cy, FRAME.hw, FRAME.hh, FRAME.radius))
    const frame = 1 - smoothstep(FRAME.stroke * 0.5 - 0.0035, FRAME.stroke * 0.5 + 0.0035, frameDist)

    // sun
    const sun = 1 - smoothstep(SUN.r - 0.0035, SUN.r + 0.0035, Math.hypot(u - SUN.cx, v - SUN.cy))

    // mountain line
    let ridgeDist = Infinity
    for (let s = 0; s < RIDGE.length - 1; s++) {
      ridgeDist = Math.min(ridgeDist, distToSegment(u, v, RIDGE[s][0], RIDGE[s][1], RIDGE[s + 1][0], RIDGE[s + 1][1]))
    }
    const ridge = 1 - smoothstep(RIDGE_STROKE * 0.5 - 0.0035, RIDGE_STROKE * 0.5 + 0.0035, ridgeDist)

    const ink = Math.max(frame, sun, ridge)
    r = lerp(r, glyph[0], ink)
    g = lerp(g, glyph[1], ink)
    b = lerp(b, glyph[2], ink)

    hi[i] = Math.round(clamp(r, 0, 255))
    hi[i + 1] = Math.round(clamp(g, 0, 255))
    hi[i + 2] = Math.round(clamp(b, 0, 255))
    hi[i + 3] = Math.round(squircleCoverage(u, v) * 255)
  }
}

// box-filter downsample
function downsample(src, srcSize, size) {
  const factor = srcSize / size
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      const startX = Math.floor(x * factor)
      const startY = Math.floor(y * factor)
      const endX = Math.floor((x + 1) * factor)
      const endY = Math.floor((y + 1) * factor)
      for (let sy = startY; sy < endY; sy++) {
        for (let sx = startX; sx < endX; sx++) {
          const si = (sy * srcSize + sx) * 4
          r += src[si]
          g += src[si + 1]
          b += src[si + 2]
          a += src[si + 3]
          n++
        }
      }
      const oi = (y * size + x) * 4
      out[oi] = Math.round(r / n)
      out[oi + 1] = Math.round(g / n)
      out[oi + 2] = Math.round(b / n)
      out[oi + 3] = Math.round(a / n)
    }
  }
  return out
}

// ---------- PNG encoding ----------
const crcTable = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- ICO encoding ----------
function encodeIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)

  const dir = Buffer.alloc(16 * entries.length)
  let offset = 6 + dir.length

  entries.forEach((entry, index) => {
    const base = index * 16
    dir[base] = entry.size >= 256 ? 0 : entry.size
    dir[base + 1] = entry.size >= 256 ? 0 : entry.size
    dir[base + 2] = 0
    dir[base + 3] = 0
    dir.writeUInt16LE(1, base + 4)
    dir.writeUInt16LE(32, base + 6)
    dir.writeUInt32LE(entry.png.length, base + 8)
    dir.writeUInt32LE(offset, base + 12)
    offset += entry.png.length
  })

  return Buffer.concat([header, dir, ...entries.map((entry) => entry.png)])
}

// ---------- write ----------
await mkdir(outDir, { recursive: true })

await writeFile(path.join(outDir, 'icon.png'), encodePng(downsample(hi, SS, SIZE), SIZE))

const sizes = [16, 24, 32, 48, 64, 128, 256]
const entries = sizes.map((size) => ({ size, png: encodePng(downsample(hi, SS, size), size) }))
await writeFile(path.join(outDir, 'icon.ico'), encodeIco(entries))

console.log(`icon.png (${SIZE}x${SIZE}) and icon.ico (${sizes.join(', ')}) written to build/`)
