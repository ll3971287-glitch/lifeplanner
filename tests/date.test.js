import { describe, it, expect } from 'vitest'
import {
  DAY_MS,
  fmtDate,
  fmtTime,
  fmtDateTime,
  fmtDurationMin,
  parseDateStr,
  parseDateTimeStr,
  startOfDayTs,
  endOfDayTs,
  addDaysTs,
  startOfWeekTs,
  isSameDayTs,
  isBetweenTs,
  periodAnchorTs,
  periodRangeTs,
  periodLabel,
  weekDaysTs,
  monthGridTs,
  minuteOfDayTs,
  nextRecurrenceTs,
  PERIOD_TYPES,
  PERIOD_TYPE_LABEL,
} from '../src/utils/date.js'

describe('日期：格式化与解析', () => {
  it('fmtDate / parseDateStr 往返', () => {
    const ts = parseDateStr('2026-09-02')
    expect(fmtDate(ts)).toBe('2026-09-02')
  })

  it('parseDateTimeStr 支持时分秒', () => {
    const ts = parseDateTimeStr('2026-09-02 23:05:09')
    expect(fmtDateTime(ts, true)).toBe('2026-09-02 23:05:09')
    expect(fmtDateTime(ts, false)).toBe('2026-09-02 23:05')
  })

  it('parseDateTimeStr 缺省时间为 00:00:00', () => {
    const ts = parseDateTimeStr('2026-09-02')
    expect(fmtDateTime(ts, true)).toBe('2026-09-02 00:00:00')
  })

  it('startOfDayTs / endOfDayTs', () => {
    const t = parseDateTimeStr('2026-09-02 15:30:20')
    expect(fmtDateTime(startOfDayTs(t), true)).toBe('2026-09-02 00:00:00')
    expect(endOfDayTs(t) - startOfDayTs(t)).toBe(DAY_MS - 1)
  })

  it('isSameDayTs / isBetweenTs / addDaysTs', () => {
    const a = parseDateTimeStr('2026-09-02 08:00:00')
    const b = parseDateTimeStr('2026-09-02 23:00:00')
    const c = parseDateTimeStr('2026-09-03 00:00:00')
    expect(isSameDayTs(a, b)).toBe(true)
    expect(isSameDayTs(a, c)).toBe(false)
    expect(isBetweenTs(b, a, c)).toBe(true)
    expect(fmtDate(addDaysTs(a, 3))).toBe('2026-09-05')
    expect(fmtDate(addDaysTs(a, -1))).toBe('2026-09-01')
  })
})

describe('日期：周', () => {
  it('startOfWeekTs 返回周一 00:00 且不晚于当天', () => {
    const t = parseDateTimeStr('2026-09-02 15:30:00')
    const ws = startOfWeekTs(t)
    expect(new Date(ws).getDay()).toBe(1)
    expect(ws).toBeLessThanOrEqual(t)
  })

  it('weekDaysTs 返回 7 天且覆盖锚点所在周', () => {
    const t = parseDateStr('2026-09-02')
    const days = weekDaysTs(t)
    expect(days.length).toBe(7)
    expect(days[1] - days[0]).toBe(DAY_MS)
    expect(days.some((d) => isSameDayTs(d, t))).toBe(true)
  })
})

describe('日期：月网格', () => {
  it('monthGridTs 生成 42 格，首周一末周日，含当月首日', () => {
    const g = monthGridTs(2026, 8)
    expect(g.length).toBe(42)
    expect(new Date(g[0]).getDay()).toBe(1)
    expect(new Date(g[41]).getDay()).toBe(0)
    expect(g.some((x) => fmtDate(x) === '2026-09-01')).toBe(true)
    expect(g.some((x) => fmtDate(x) === '2026-10-01')).toBe(true)
  })
})

describe('日期：复盘周期', () => {
  it('PERIOD_TYPES 与标签完整', () => {
    expect(PERIOD_TYPES).toEqual(['day', 'week', 'month', 'year', 'five'])
    expect(Object.keys(PERIOD_TYPE_LABEL)).toHaveLength(5)
  })

  it('periodAnchorTs 各周期锚点', () => {
    const now = parseDateTimeStr('2026-09-02 15:30:00')
    expect(fmtDate(periodAnchorTs('day', now))).toBe('2026-09-02')
    expect(fmtDate(periodAnchorTs('week', now))).toBe(fmtDate(startOfWeekTs(now)))
    expect(fmtDate(periodAnchorTs('month', now))).toBe('2026-09-01')
    expect(fmtDate(periodAnchorTs('year', now))).toBe('2026-01-01')
    expect(fmtDate(periodAnchorTs('five', now))).toBe('2025-01-01')
    expect(fmtDate(periodAnchorTs('five', parseDateTimeStr('2023-05-01 10:00:00')))).toBe('2020-01-01')
  })

  it('periodRangeTs 区间正确且包含锚点', () => {
    const now = parseDateTimeStr('2026-09-02 15:30:00')
    for (const type of PERIOD_TYPES) {
      const a = periodAnchorTs(type, now)
      const [s, e] = periodRangeTs(type, a)
      expect(s).toBeLessThan(e)
      expect(isBetweenTs(a, s, e)).toBe(true)
      expect(isBetweenTs(now, s, e)).toBe(true)
    }
    const [, eDay] = periodRangeTs('day', now)
    expect(eDay - parseDateStr('2026-09-02')).toBe(DAY_MS)
    const [sWeek, eWeek] = periodRangeTs('week', now)
    expect(eWeek - sWeek).toBe(7 * DAY_MS)
  })

  it('periodLabel 展示', () => {
    const a = periodAnchorTs('five', parseDateTimeStr('2026-09-02 10:00:00'))
    expect(periodLabel('five', a)).toBe('2025 ~ 2029')
    expect(periodLabel('year', periodAnchorTs('year', parseDateStr('2026-09-02')))).toBe('2026 年')
    expect(periodLabel('month', periodAnchorTs('month', parseDateStr('2026-09-02')))).toBe('2026 年 9 月')
  })
})

describe('日期：杂项', () => {
  it('minuteOfDayTs', () => {
    expect(minuteOfDayTs(parseDateTimeStr('2026-09-02 08:05:00'))).toBe(485)
    expect(minuteOfDayTs(parseDateTimeStr('2026-09-02 00:00:00'))).toBe(0)
    expect(minuteOfDayTs(parseDateTimeStr('2026-09-02 23:59:00'))).toBe(1439)
  })

  it('nextRecurrenceTs 按日/周/月/年推进并保持时分秒', () => {
    const base = parseDateTimeStr('2026-09-02 09:30:00')
    expect(fmtDateTime(nextRecurrenceTs(base, 'daily', 1), true)).toBe('2026-09-03 09:30:00')
    expect(fmtDateTime(nextRecurrenceTs(base, 'weekly', 1), true)).toBe('2026-09-09 09:30:00')
    expect(fmtDateTime(nextRecurrenceTs(base, 'weekly', 2), true)).toBe('2026-09-16 09:30:00')
    expect(fmtDateTime(nextRecurrenceTs(base, 'monthly', 1), true)).toBe('2026-10-02 09:30:00')
    expect(fmtDateTime(nextRecurrenceTs(base, 'monthly', 3), true)).toBe('2026-12-02 09:30:00')
    expect(fmtDateTime(nextRecurrenceTs(base, 'yearly', 1), true)).toBe('2027-09-02 09:30:00')
  })

  it('nextRecurrenceTs 月尾与闰年自动收敛日期', () => {
    const jan31 = parseDateTimeStr('2026-01-31 08:00:00')
    expect(fmtDate(nextRecurrenceTs(jan31, 'monthly', 1))).toBe('2026-02-28')
    expect(fmtDate(nextRecurrenceTs(jan31, 'monthly', 2))).toBe('2026-03-31')
    const leap = parseDateTimeStr('2024-02-29 08:00:00')
    expect(fmtDate(nextRecurrenceTs(leap, 'yearly', 1))).toBe('2025-02-28')
  })

  it('fmtDurationMin', () => {
    expect(fmtDurationMin(0)).toBe('0 分钟')
    expect(fmtDurationMin(45)).toBe('45 分钟')
    expect(fmtDurationMin(60)).toBe('1 小时')
    expect(fmtDurationMin(125)).toBe('2 小时 5 分')
  })

  it('fmtTime 秒参数', () => {
    const t = parseDateTimeStr('2026-09-02 09:08:07')
    expect(fmtTime(t, true)).toBe('09:08:07')
    expect(fmtTime(t)).toBe('09:08')
  })
})
