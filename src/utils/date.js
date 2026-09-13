export const DAY_MS = 86400000

export const pad = (n) => String(n).padStart(2, '0')

export function fmtDate(t) {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fmtTime(t, withSeconds = false) {
  const d = new Date(t)
  const h = pad(d.getHours())
  const m = pad(d.getMinutes())
  return withSeconds ? `${h}:${m}:${pad(d.getSeconds())}` : `${h}:${m}`
}

export function fmtDateTime(t, withSeconds = false) {
  return `${fmtDate(t)} ${fmtTime(t, withSeconds)}`
}

export function parseDateStr(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

export function parseDateTimeStr(s) {
  const [datePart, timePart = '00:00:00'] = s.split(' ')
  const [h, m, sec = 0] = timePart.split(':').map(Number)
  const t = parseDateStr(datePart)
  const d = new Date(t)
  d.setHours(h, m, sec)
  return d.getTime()
}

export function startOfDayTs(t) {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function endOfDayTs(t) {
  return startOfDayTs(t) + DAY_MS - 1
}

export function addDaysTs(t, n) {
  const d = new Date(t)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

export function addMonthsTs(t, n) {
  const d = new Date(t)
  d.setMonth(d.getMonth() + n)
  return d.getTime()
}

export function addYearsTs(t, n) {
  const d = new Date(t)
  d.setFullYear(d.getFullYear() + n)
  return d.getTime()
}

// 以“原锚点的日/时/分/秒”为准推进 k 个自然月或自然年（日期超限自动收敛到月末，闰年 2/29 → 2/28）
export function addPeriodsKeepClock(ts, freq, k) {
  const d = new Date(ts)
  const day = d.getDate()
  const h = d.getHours()
  const min = d.getMinutes()
  const s = d.getSeconds()
  const ms = d.getMilliseconds()
  let y = d.getFullYear()
  let m = d.getMonth()
  if (freq === 'monthly') {
    const idx = y * 12 + m + k
    y = Math.floor(idx / 12)
    m = idx % 12
  } else if (freq === 'yearly') {
    y += k
  }
  const last = new Date(y, m + 1, 0).getDate()
  const nd = new Date(y, m, Math.min(day, last))
  nd.setHours(h, min, s, ms)
  return nd.getTime()
}

export function nextRecurrenceTs(ts, freq, step = 1) {
  const k = Math.max(1, Math.round(step) || 1)
  if (freq === 'weekly') return addDaysTs(ts, 7 * k)
  if (freq === 'monthly') return addPeriodsKeepClock(ts, 'monthly', k)
  if (freq === 'yearly') return addPeriodsKeepClock(ts, 'yearly', k)
  return addDaysTs(ts, k)
}

export function todayTs(now = Date.now()) {
  return startOfDayTs(now)
}

export function isSameDayTs(a, b) {
  return startOfDayTs(a) === startOfDayTs(b)
}

export function startOfWeekTs(t) {
  const day = startOfDayTs(t)
  const w = (new Date(day).getDay() + 6) % 7
  return addDaysTs(day, -w)
}

export function isBetweenTs(t, startTs, endExclusiveTs) {
  return t >= startTs && t < endExclusiveTs
}

export const PERIOD_TYPES = ['day', 'week', 'month', 'year', 'five']

export const PERIOD_TYPE_LABEL = {
  day: '日复盘',
  week: '周复盘',
  month: '月复盘',
  year: '年复盘',
  five: '五年复盘',
}

export function periodAnchorTs(type, now = Date.now()) {
  const d = new Date(now)
  if (type === 'day') return startOfDayTs(now)
  if (type === 'week') return startOfWeekTs(now)
  if (type === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  if (type === 'year') return new Date(d.getFullYear(), 0, 1).getTime()
  if (type === 'five') {
    const y = Math.floor(d.getFullYear() / 5) * 5
    return new Date(y, 0, 1).getTime()
  }
  return startOfDayTs(now)
}

export function periodRangeTs(type, anchorTs) {
  const d = new Date(anchorTs)
  if (type === 'day') {
    const s = startOfDayTs(anchorTs)
    return [s, s + DAY_MS]
  }
  if (type === 'week') {
    const s = startOfWeekTs(anchorTs)
    return [s, s + 7 * DAY_MS]
  }
  if (type === 'month') {
    return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()]
  }
  if (type === 'year') {
    return [new Date(d.getFullYear(), 0, 1).getTime(), new Date(d.getFullYear() + 1, 0, 1).getTime()]
  }
  if (type === 'five') {
    const y = Math.floor(d.getFullYear() / 5) * 5
    return [new Date(y, 0, 1).getTime(), new Date(y + 5, 0, 1).getTime()]
  }
  const s = startOfDayTs(anchorTs)
  return [s, s + DAY_MS]
}

export function periodLabel(type, anchorTs) {
  const d = new Date(anchorTs)
  if (type === 'day') return fmtDate(anchorTs)
  if (type === 'week') {
    const s = startOfWeekTs(anchorTs)
    return `${fmtDate(s)} ~ ${fmtDate(s + 7 * DAY_MS - 1)}`
  }
  if (type === 'month') return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`
  if (type === 'year') return `${d.getFullYear()} 年`
  if (type === 'five') {
    const y = Math.floor(d.getFullYear() / 5) * 5
    return `${y} ~ ${y + 4}`
  }
  return ''
}

export function weekDaysTs(anchorTs) {
  const s = startOfWeekTs(anchorTs)
  return Array.from({ length: 7 }, (_, i) => s + i * DAY_MS)
}

export function monthGridTs(year, month) {
  const first = new Date(year, month, 1).getTime()
  const s = startOfWeekTs(first)
  return Array.from({ length: 42 }, (_, i) => s + i * DAY_MS)
}

export function minuteOfDayTs(t) {
  const d = new Date(t)
  return d.getHours() * 60 + d.getMinutes()
}

export function fmtDurationMin(min) {
  const n = Math.max(0, Math.round(min))
  if (n < 60) return `${n} 分钟`
  const h = Math.floor(n / 60)
  const m = n % 60
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`
}

export function fmtDurationMs(ms) {
  return fmtDurationMin(ms / 60000)
}
