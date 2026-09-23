import { fmtTime, fmtDate, fmtDateTime, startOfDayTs, endOfDayTs, DAY_MS } from './utils/date.js'

export function shortDate(ts) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function shortDateTime(ts) {
  return `${shortDate(ts)} ${fmtTime(ts)}`
}

export const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function weekdayOf(ts) {
  const d = new Date(ts)
  return WEEKDAY_LABELS[(d.getDay() + 6) % 7]
}

export function todoTimeText(todo) {
  if (!todo || todo.startAt == null) return ''
  switch (todo.timeType) {
    case 'date':
      return shortDate(todo.startAt)
    case 'datetime':
      return shortDateTime(todo.startAt)
    case 'range': {
      if (todo.endAt == null) return shortDateTime(todo.startAt)
      const sameDay = startOfDayTs(todo.startAt) === startOfDayTs(todo.endAt)
      return sameDay
        ? `${shortDateTime(todo.startAt)} – ${fmtTime(todo.endAt)}`
        : `${shortDateTime(todo.startAt)} – ${shortDateTime(todo.endAt)}`
    }
    default:
      return ''
  }
}

export function deadlineText(ts, nowTs = Date.now()) {
  if (ts == null) return ''
  const dayStart = startOfDayTs(ts)
  const todayStart = startOfDayTs(nowTs)
  const diffDays = Math.round((dayStart - todayStart) / DAY_MS)
  if (diffDays === 0) return '今天截止'
  if (diffDays === 1) return '明天截止'
  if (diffDays === -1) return '昨天截止'
  if (diffDays < 0) return `已逾期 ${-diffDays} 天`
  return `剩 ${diffDays} 天`
}

export function fmtFocusMinute(min) {
  const n = Math.round(min || 0)
  if (n < 60) return `${n}m`
  const h = Math.floor(n / 60)
  const m = n % 60
  return m ? `${h}h${String(m).padStart(2, '0')}m` : `${h}h`
}

export function fmtDayOfWeek(ts) {
  return `${shortDate(ts)} ${weekdayOf(ts)}`
}

export function fileDateStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

export function countdownText(endTs, nowTs = Date.now()) {
  if (endTs == null) return ''
  const today = startOfDayTs(nowTs)
  const endDay = startOfDayTs(endTs)
  if (today > endDay) return '已结束'
  const days = Math.round((endDay - today) / DAY_MS)
  if (days === 0) return '今天结束'
  if (days === 1) return '明天结束'
  return `剩 ${days} 天`
}

export function recurText(recurrence) {
  if (!recurrence) return ''
  const unit = { daily: '天', weekly: '周', monthly: '个月', yearly: '年' }[recurrence.freq]
  const step = Math.max(1, recurrence.step || 1)
  if (step === 1) {
    return { daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' }[recurrence.freq] || ''
  }
  return `每 ${step} ${unit}`
}

export function fmtFullDate(ts) {
  return `${fmtDate(ts)} ${weekdayOf(ts)}`
}

// 延期（推迟）状态：宽限期内返回延期后的截止时间文案，否则为空
export function snoozeText(t, nowTs = Date.now()) {
  if (!t || t.snoozeUntil == null || t.completed || t.canceled) return ''
  if (nowTs >= t.snoozeUntil) return ''
  return fmtDateTime(t.snoozeUntil)
}

export function delayActive(t, nowTs = Date.now()) {
  return !!snoozeText(t, nowTs)
}
