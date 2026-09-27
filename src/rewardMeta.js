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

export const CONDITION_TYPES = [
  { key: 'focus', label: '专注时长', hint: '累计专注达到指定分钟数（历史累计）' },
  { key: 'todos', label: '完成任务', hint: '累计完成任务达到指定数量（历史累计）' },
  { key: 'custom', label: '自定义条件', hint: '写下条件，达成后自己手动打勾确认' },
]

export const CONDITION_OPTIONS = CONDITION_TYPES.map((c) => ({ label: c.label, value: c.key }))

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
  if (reward.conditionType === 'todos') return `累计完成 ${reward.conditionValue} 个任务`
  if (reward.conditionType === 'custom') return reward.conditionText || '自定义条件'
  return `累计专注 ${reward.conditionValue} 分钟`
}

export function conditionUnit(reward) {
  if (reward && reward.conditionType === 'todos') return '个任务'
  if (reward && reward.conditionType === 'focus') return '分钟'
  return ''
}
