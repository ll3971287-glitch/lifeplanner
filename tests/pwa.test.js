import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PUBLIC = join(process.cwd(), 'public')

function readPngHeader(size) {
  const buf = readFileSync(join(PUBLIC, 'icons', `icon-${size}.png`))
  return {
    buf,
    sig: [...buf.subarray(0, 8)],
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
  }
}

describe('PWA 资源', () => {
  it('manifest.webmanifest 是合法 JSON 且指向存在的图标', () => {
    const text = readFileSync(join(PUBLIC, 'manifest.webmanifest'), 'utf8')
    const manifest = JSON.parse(text)
    expect(manifest.name).toBeTruthy()
    expect(manifest.start_url).toBeTruthy()
    expect(manifest.display).toBe('standalone')
    expect(Array.isArray(manifest.icons)).toBe(true)
    for (const icon of manifest.icons) {
      expect(readFileSync(join(PUBLIC, icon.src)).length).toBeGreaterThan(0)
    }
  })

  it('192/512 图标是合法 PNG 且尺寸正确（RGBA 8bit）', () => {
    for (const size of [192, 512]) {
      const h = readPngHeader(size)
      expect(h.sig).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      expect(h.width).toBe(size)
      expect(h.height).toBe(size)
      expect(h.bitDepth).toBe(8)
      expect(h.colorType).toBe(6)
    }
  })

  it('service worker 具备安装/激活/取回三段处理', () => {
    const text = readFileSync(join(PUBLIC, 'sw.js'), 'utf8')
    expect(text).toContain("addEventListener('install'")
    expect(text).toContain("addEventListener('activate'")
    expect(text).toContain("addEventListener('fetch'")
    expect(text).toContain('skipWaiting')
    expect(text).toContain('caches.match')
  })

  it('index.html 引用了 manifest', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
    expect(html).toContain('manifest.webmanifest')
    expect(html).toContain('viewport')
  })
})
