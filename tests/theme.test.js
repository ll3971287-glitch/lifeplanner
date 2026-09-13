import { describe, it, expect, beforeEach } from 'vitest'
import { PALETTE_LIST, DEFAULT_PALETTE, applyTheme, themeVars, TAG_COLORS } from '../src/theme.js'

beforeEach(() => {
  const root = document.documentElement
  root.removeAttribute('style')
  root.removeAttribute('data-mode')
  root.classList.remove('style-neomin')
})

describe('Neo-minimal 主题系统', () => {
  it('提供 3 套 muted·monochromatic 主题，id 唯一', () => {
    expect(PALETTE_LIST.length).toBe(3)
    expect(new Set(PALETTE_LIST.map((p) => p.id)).size).toBe(3)
    for (const p of PALETTE_LIST) {
      expect(p.primary).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(p.accent).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('主题为低饱和单色系：文字与强调同系调和（muted postal）', () => {
    const vars = themeVars('ink')
    expect(vars.text).toBe('#3B3934')
    expect(vars.accent).toBe('#5476B8')
    expect(vars.success).toBe('#6F9E63')
    expect(vars.bg).toBe('#FAF9F6')
    // 每套主题至少 4 个可辨识颜色（非灰阶双色）
    const fog = themeVars('fog')
    const moss = themeVars('moss')
    const sets = [vars, fog, moss]
    for (const v of sets) {
      const colors = new Set([v.text, v.primaryDeep, v.accent, v.accentDeep, v.success, v.danger])
      expect(colors.size).toBeGreaterThanOrEqual(5)
    }
  })

  it('浅色模式写变量并标记 neomin/明暗', () => {
    applyTheme('fog')
    const root = document.documentElement
    expect(root.style.getPropertyValue('--primary')).toBe('#E3EBF2')
    expect(root.style.getPropertyValue('--bg')).toBe('#F4F7FA')
    expect(root.dataset.mode).toBe('light')
    expect(root.classList.contains('style-neomin')).toBe(true)
  })

  it('深色模式统一推导并提亮主/强调', () => {
    applyTheme('moss', { mode: 'dark' })
    const root = document.documentElement
    expect(root.dataset.mode).toBe('dark')
    expect(root.style.getPropertyValue('--bg')).toBe('#0D0F13')
    expect(root.style.getPropertyValue('--text')).toBe('#E7E9E6')
    expect(root.style.getPropertyValue('--primary-deep')).toContain('color-mix')
  })

  it('未知主题回退默认', () => {
    applyTheme('nope')
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(PALETTE_LIST.find((p) => p.id === DEFAULT_PALETTE).primary)
  })

  it('themeVars 键齐全且标签色板可用', () => {
    for (const id of PALETTE_LIST.map((p) => p.id)) {
      const v = themeVars(id, 'dark')
      for (const k of ['primary', 'primaryDeep', 'accent', 'accentDeep', 'bg', 'card', 'text', 'textDim', 'line', 'success', 'danger', 'warn']) expect(v[k]).toBeTruthy()
    }
    expect(TAG_COLORS.length).toBeGreaterThanOrEqual(8)
  })
})
