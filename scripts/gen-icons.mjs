// 零依赖生成 PWA 图标：圆角底 + 白色对勾（纯 Node，zlib 手写 PNG 编码）
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'icons')
mkdirSync(OUT, { recursive: true })

const BG = [15, 118, 110] // #0F766E
const FG = [255, 255, 255]

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(size, pixelFn) {
  const stride = 1 + size * 4
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y)
      const off = y * stride + 1 + x * 4
      raw[off] = r
      raw[off + 1] = g
      raw[off + 2] = b
      raw[off + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const idat = deflateSync(raw)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

function inRoundRect(x, y, size, radius) {
  const x0 = radius
  const x1 = size - radius
  const y0 = radius
  const y1 = size - radius
  if (x >= x0 && x <= x1) return y >= 0 && y <= size
  if (y >= y0 && y <= y1) return x >= 0 && x <= size
  const cx = x < x0 ? x0 : x1
  const cy = y < y0 ? y0 : y1
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius
}

function makePixelFn(size) {
  const radius = size * 0.2
  const p1 = [size * 0.29, size * 0.53]
  const p2 = [size * 0.44, size * 0.68]
  const p3 = [size * 0.73, size * 0.32]
  const halfW = size * 0.045
  return (x, y) => {
    const px = x + 0.5
    const py = y + 0.5
    if (!inRoundRect(px, py, size, radius)) return [0, 0, 0, 0]
    if (distToSegment(px, py, ...p1, ...p2) <= halfW || distToSegment(px, py, ...p2, ...p3) <= halfW) {
      return [...FG, 255]
    }
    return [...BG, 255]
  }
}

for (const size of [192, 512]) {
  const buf = encodePng(size, makePixelFn(size))
  writeFileSync(join(OUT, `icon-${size}.png`), buf)
  console.log(`generated icon-${size}.png (${buf.length} bytes)`)
}
