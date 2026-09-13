import { describe, it, expect } from 'vitest'
import { countdownText, recurText } from '../src/format.js'
import { startOfDayTs, addDaysTs, DAY_MS, parseDateStr } from '../src/utils/date.js'

describe('打卡倒计时与文本', () => {
  const now = parseDateStr('2026-09-02') + 12 * 3600000 // 9-2 中午

  it('countdownText：距结束整天取上整', () => {
    const end = addDaysTs(startOfDayTs(now), 3)
    expect(countdownText(end, now)).toBe('剩 3 天')
    expect(countdownText(addDaysTs(startOfDayTs(now), 1), now)).toBe('明天结束')
  })

  it('countdownText：今天结束与已结束', () => {
    expect(countdownText(startOfDayTs(now), now)).toBe('今天结束')
    expect(countdownText(startOfDayTs(now) - DAY_MS, now)).toBe('已结束')
  })

  it('countdownText：无日期为空', () => {
    expect(countdownText(null)).toBe('')
  })

  it('recurText 周期文案', () => {
    expect(recurText(null)).toBe('')
    expect(recurText({ freq: 'weekly', step: 1 })).toBe('每周')
    expect(recurText({ freq: 'monthly', step: 3 })).toBe('每 3 个月')
  })
})
