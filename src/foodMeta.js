// 食物储存：位置 / 状态 / 保质期预设库 / 过期与临期判定
import { DAY_MS, startOfDayTs, endOfDayTs } from './utils/date.js'

export const FOOD_PLACES = [
  { key: 'fridge', label: '冷藏', color: '#3B82F6' },
  { key: 'freezer', label: '冷冻', color: '#0EA5E9' },
  { key: 'room', label: '常温', color: '#C29B26' },
]

export const FOOD_STATUS = {
  stored: { key: 'stored', label: '在库', cls: 'stored' },
  consumed: { key: 'consumed', label: '已消耗', cls: 'consumed' },
  discarded: { key: 'discarded', label: '已丢弃', cls: 'discarded' },
}
export const FOOD_STATUS_ORDER = ['stored', 'consumed', 'discarded']

export const FOOD_CATEGORIES = [
  '蔬菜',
  '水果',
  '肉类',
  '海鲜',
  '蛋类',
  '奶制品',
  '熟食剩菜',
  '面包烘焙',
  '零食饼干',
  '饮料',
  '调味品',
  '冷冻食品',
  '其他',
]

// 参考保质期（天）：[未开封, 已开封]；null 表示该位置不适用
const SHELF_DAYS = {
  蔬菜: { fridge: [7, 3], freezer: [60, 30], room: [2, 1] },
  水果: { fridge: [7, 3], freezer: [90, 30], room: [3, 2] },
  肉类: { fridge: [2, 1], freezer: [180, 90], room: null },
  海鲜: { fridge: [1, 1], freezer: [90, 60], room: null },
  蛋类: { fridge: [30, 14], freezer: null, room: [7, 3] },
  奶制品: { fridge: [7, 3], freezer: [30, 15], room: [1, 1] },
  熟食剩菜: { fridge: [3, 2], freezer: [30, 15], room: null },
  面包烘焙: { room: [3, 2], fridge: [7, 3], freezer: [30, 15] },
  零食饼干: { room: [90, 30], fridge: [120, 60], freezer: null },
  饮料: { room: [180, 7], fridge: [30, 3], freezer: null },
  调味品: { room: [365, 180], fridge: [180, 90], freezer: null },
  冷冻食品: { freezer: [180, 90], fridge: [3, 1], room: null },
  其他: { fridge: [7, 3], freezer: [90, 30], room: [7, 3] },
}

// 临期预警：剩余 ≤ 3 天
export const NEAR_DAYS = 3

export function placeLabel(key) {
  const p = FOOD_PLACES.find((x) => x.key === key)
  return p ? p.label : '冷藏'
}
export function placeColor(key) {
  const p = FOOD_PLACES.find((x) => x.key === key)
  return p ? p.color : '#9CA3AF'
}
export function statusLabel(key) {
  return (FOOD_STATUS[key] || FOOD_STATUS.stored).label
}

// 参考保质期天数（建议值）；不适用时返回 null
export function suggestDays(category, place, opened) {
  const row = SHELF_DAYS[category] || SHELF_DAYS.其他
  const pair = row[place]
  if (!pair) return null
  return pair[opened ? 1 : 0]
}

// 建议过期时间：入库日 + 参考天数（当天 23:59）
export function suggestExpireAt(storedAt, category, place, opened) {
  const days = suggestDays(category, place, opened)
  if (days == null) return null
  return endOfDayTs(startOfDayTs(storedAt) + days * DAY_MS)
}

// 剩余天数（按日期差）：0 = 今天到期；负数 = 已过期
export function daysLeft(expireAt, nowTs = Date.now()) {
  if (expireAt == null) return null
  return Math.round((startOfDayTs(expireAt) - startOfDayTs(nowTs)) / DAY_MS)
}

// 状态色：over 已过期 / near 临期 / ok 安全 / off 已出库
export function foodLevel(item, nowTs = Date.now()) {
  if (!item || item.status !== 'stored') return 'off'
  const left = daysLeft(item.expireAt, nowTs)
  if (left == null) return 'ok'
  if (left < 0) return 'over'
  if (left <= NEAR_DAYS) return 'near'
  return 'ok'
}

export function levelLabel(level) {
  if (level === 'over') return '已过期'
  if (level === 'near') return '临期'
  if (level === 'off') return '已出库'
  return '安全'
}

export function leftText(item, nowTs = Date.now()) {
  const left = daysLeft(item.expireAt, nowTs)
  if (left == null) return '未设过期时间'
  if (left < 0) return `已过期 ${-left} 天`
  if (left === 0) return '今天到期'
  return `剩 ${left} 天`
}
