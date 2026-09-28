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

// 大致时间预估：模糊时间段，不用具体日期
export const TIME_HINTS = [
  { key: 'quarter', label: '一季度后' },
  { key: 'halfYear', label: '半年后' },
  { key: 'year', label: '1 年后' },
  { key: 'years', label: '若干年后' },
]

export const TIME_HINT_OPTIONS = [{ label: '不限', value: '' }, ...TIME_HINTS.map((t) => ({ label: t.label, value: t.key }))]

export function timeHintLabel(key) {
  const hit = TIME_HINTS.find((t) => t.key === key)
  return hit ? hit.label : ''
}

export const SHOP_DEFAULT_RATE = { coinPerFocusMin: 1, coinPerTodo: 5, coinPerCheckin: 1, coinPerReview: 1 }

export function shopRate(settings) {
  const raw = (settings && settings.shop) || {}
  const pick = (key) => (raw[key] == null ? SHOP_DEFAULT_RATE[key] : Number(raw[key]) || 0)
  return {
    coinPerFocusMin: pick('coinPerFocusMin'),
    coinPerTodo: pick('coinPerTodo'),
    coinPerCheckin: pick('coinPerCheckin'),
    coinPerReview: pick('coinPerReview'),
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
