// 兑换商店：稀有度、图标调色板与解锁条件元数据

export const RARITIES = [
  { key: 'common', label: '普通', color: '#64748B' },
  { key: 'rare', label: '稀有', color: '#3B82F6' },
  { key: 'epic', label: '史诗', color: '#7C3AED' },
  { key: 'legend', label: '传说', color: '#E8A33D' },
]

export const RARITY_OPTIONS = RARITIES.map((r) => ({ label: r.label, value: r.key }))

export function rarityMeta(key) {
  return RARITIES.find((r) => r.key === key) || RARITIES[0]
}

// 奖励图标：预设 emoji 调色板（也可自行输入任意 emoji）
export const ICON_CHOICES = ['🎁', '🍿', '🧋', '🍰', '🍜', '🎮', '📚', '🎬', '🎧', '🛌', '🎫', '🧸']

export const SHOP_DEFAULT_RATE = { coinPerFocusMin: 1, coinPerTodo: 5 }

export function shopRate(settings) {
  const raw = (settings && settings.shop) || {}
  return {
    coinPerFocusMin: raw.coinPerFocusMin == null ? SHOP_DEFAULT_RATE.coinPerFocusMin : Number(raw.coinPerFocusMin) || 0,
    coinPerTodo: raw.coinPerTodo == null ? SHOP_DEFAULT_RATE.coinPerTodo : Number(raw.coinPerTodo) || 0,
  }
}

export function conditionLabel(reward) {
  if (!reward) return ''
  return reward.conditionText || ''
}

// 金额展示：千分位 + 最多两位小数
export function moneyText(v) {
  const n = Number(v) || 0
  const fixed = Number.isInteger(n) ? String(n) : n.toFixed(2)
  const [int, dec] = fixed.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `¥${grouped}${dec ? `.${dec}` : ''}`
}
