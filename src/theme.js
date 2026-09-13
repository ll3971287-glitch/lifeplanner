export const DEFAULT_PALETTE = 'ink'
export const DEFAULT_MODE = 'light'
export const DEFAULT_STYLE = 'neomin'

// Neo-minimalism · 三套 muted·monochromatic 主题（同色系不同阶，Postal 柔和质感）
const PAL = [
  {
    id: 'ink', name: '墨灰 × 靛蓝撞色',
    primary: '#E9E7DF', deep: '#3C3A33', accent: '#5476B8', adeep: '#31549A',
    bg: '#FAF9F6', text: '#3B3934', dim: '#98948A', card: '#FFFFFF', line: '#EAE7DF',
    success: '#6F9E63', danger: '#D16B58', warn: '#C29B26',
  },
  {
    id: 'fog', name: '雾蓝 × 珊瑚橙撞色',
    primary: '#E3EBF2', deep: '#33526E', accent: '#E08E4C', adeep: '#C05E1F',
    bg: '#F4F7FA', text: '#33414F', dim: '#8695A3', card: '#FFFFFF', line: '#E3E9F0',
    success: '#55997E', danger: '#C95F57', warn: '#C29B26',
  },
  {
    id: 'moss', name: '苔绿 × 莓粉撞色',
    primary: '#E7ECDB', deep: '#46523A', accent: '#C95F87', adeep: '#A2336A',
    bg: '#F8F9F3', text: '#3B4333', dim: '#8C9384', card: '#FFFFFF', line: '#E8ECDC',
    success: '#63A460', danger: '#C96A4E', warn: '#B49A26',
  },
]

export const PALETTE_LIST = PAL.map((p) => ({ id: p.id, name: p.name, primary: p.primary, deep: p.deep, accent: p.accent, adeep: p.adeep }))

const VAR_KEYS = ['primary', 'primaryDeep', 'accent', 'accentDeep', 'bg', 'card', 'text', 'textDim', 'line', 'success', 'danger', 'warn']

export function getPalette(id) {
  return PAL.find((p) => p.id === id) || PAL[0]
}

export function themeVars(paletteId, mode = 'light') {
  const p = getPalette(paletteId)
  const v = {
    primary: p.primary,
    primaryDeep: p.deep,
    accent: p.accent,
    accentDeep: p.adeep,
    bg: p.bg,
    card: p.card,
    text: p.text,
    textDim: p.dim,
    line: p.line,
    success: p.success,
    danger: p.danger,
    warn: p.warn,
  }
  if (mode === 'dark') {
    v.bg = '#0D0F13'
    v.card = '#171B20'
    v.text = '#E7E9E6'
    v.textDim = '#8C918C'
    v.line = 'rgba(255,255,255,0.11)'
    v.primary = mix(p.primary, 28)
    v.primaryDeep = mix(p.deep, 64)
    v.accent = mix(p.accent, 55)
    v.accentDeep = mix(p.adeep, 70)
    v.success = mix(p.success, 52)
    v.danger = mix(p.danger, 55)
    v.warn = mix(p.warn, 58)
  }
  return v
}

function mix(hex, amount) {
  return `color-mix(in srgb, ${hex} ${amount}%, #ffffff)`
}

const PREF = { primary: '--primary', primaryDeep: '--primary-deep', accent: '--accent', accentDeep: '--accent-deep', bg: '--bg', card: '--card', text: '--text', textDim: '--text-dim', line: '--line', success: '--success', danger: '--danger', warn: '--warn' }

export function applyTheme(paletteId = DEFAULT_PALETTE, opts = {}) {
  const mode = opts.mode || DEFAULT_MODE
  const style = opts.style || DEFAULT_STYLE
  const v = themeVars(paletteId, mode)
  const root = document.documentElement
  for (const key of VAR_KEYS) root.style.setProperty(PREF[key], v[key])
  root.dataset.mode = mode
  root.classList.remove('style-glass', 'style-dopamine', 'style-nature', 'style-neomin')
  root.classList.add('style-' + style)
}

export const TAG_COLORS = ['#E11D48', '#F97316', '#F59E0B', '#10B981', '#0EA5E9', '#6366F1', '#8B5CF6', '#EC4899', '#64748B']
