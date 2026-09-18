// 书影音：五品类 / 四状态 / 进度与评分工具

export const MEDIA_CATS = [
  { key: 'book', label: '书籍', icon: 'book', unit: '页', color: '#5476B8' },
  { key: 'movie', label: '电影', icon: 'film', unit: '', color: '#E05C8C' },
  { key: 'series', label: '剧集', icon: 'tv', unit: '集', color: '#0EA5E9' },
  { key: 'anime', label: '动漫', icon: 'sparkles', unit: '集', color: '#9C6ADE' },
  { key: 'game', label: '游戏', icon: 'gamepad', unit: '小时', color: '#2E9E8F' },
]

export const MEDIA_STATUS = {
  todo: { key: 'todo', label: '未开始', cls: 'todo' },
  doing: { key: 'doing', label: '进行中', cls: 'doing' },
  done: { key: 'done', label: '已完成', cls: 'done' },
  paused: { key: 'paused', label: '已搁置', cls: 'paused' },
}
export const MEDIA_STATUS_ORDER = ['todo', 'doing', 'done', 'paused']

export function catMeta(key) {
  return MEDIA_CATS.find((c) => c.key === key) || MEDIA_CATS[0]
}
export function catLabel(key) {
  return catMeta(key).label
}
export function catColor(key) {
  return catMeta(key).color
}
export function catIcon(key) {
  return catMeta(key).icon
}

export function statusMeta(key) {
  return MEDIA_STATUS[key] || MEDIA_STATUS.todo
}
export function statusLabel(key) {
  return statusMeta(key).label
}

// 收藏清单名称：想读 / 想看 / 想玩
export function wishLabel(category) {
  if (category === 'book') return '想读'
  if (category === 'game') return '想玩'
  return '想看'
}

// 进度：返回 { text, pct }；pct 为 null 表示不显示进度条
export function progressInfo(item) {
  if (!item) return { text: '', pct: null }
  const cat = item.category
  if (cat === 'book') {
    const total = Number(item.totalPages) || 0
    const cur = Math.min(Number(item.currentPage) || 0, total || Number(item.currentPage) || 0)
    if (!total) return { text: cur ? `已读 ${cur} 页` : '', pct: item.status === 'done' ? 100 : null }
    return { text: `${cur}/${total} 页`, pct: Math.min(100, Math.round((cur / total) * 100)) }
  }
  if (cat === 'series' || cat === 'anime') {
    const total = Number(item.totalEpisodes) || 0
    const cur = Number(item.watchedEpisodes) || 0
    if (!total) return { text: cur ? `已看 ${cur} 集` : '', pct: item.status === 'done' ? 100 : null }
    return { text: `${cur}/${total} 集`, pct: Math.min(100, Math.round((cur / total) * 100)) }
  }
  if (cat === 'game') {
    const hours = Number(item.playHours) || 0
    const parts = []
    if (hours) parts.push(`${hours} 小时`)
    const levels = (item.levels || '').split(/[\n,，、]/).map((s) => s.trim()).filter(Boolean)
    if (levels.length) parts.push(`${levels.length} 个关卡`)
    const ach = (item.achievements || []).length
    if (ach) parts.push(`${ach} 个成就`)
    return { text: parts.join(' · '), pct: item.status === 'done' ? 100 : null }
  }
  // 电影：单作品记录模式，无进度条
  return { text: '', pct: item.status === 'done' ? 100 : null }
}

export function ratingStars(rating) {
  const n = Math.max(0, Math.min(5, Number(rating) || 0))
  return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n)
}

export function yearOf(ts) {
  return ts == null ? null : new Date(ts).getFullYear()
}
