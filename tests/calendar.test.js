import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { startOfDayTs, addDaysTs, fmtDate, DAY_MS, startOfWeekTs } from '../src/utils/date.js'
import CalendarView from '../src/views/CalendarView.vue'

beforeEach(() => {
  store._replace(defaultState())
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('日历三视图聚合', () => {
  const today0 = () => startOfDayTs(Date.now())

  function seed() {
    const d = today0()
    store.addTodo({ title: '全天安排', timeType: 'date', startAt: d })
    store.addTodo({ title: '上午会议', timeType: 'datetime', startAt: d + 10 * 3600000 })
    store.addTodo({ title: '写报告', timeType: 'range', startAt: d + 12 * 3600000, endAt: d + 13 * 3600000 })
    store.addSession({ mode: 'pomodoro', targetType: 'none', startAt: d + 11 * 3600000, endAt: d + 11.5 * 3600000, durationMin: 30 })
  }

  it('日视图展示全天、时间点、时间段与专注条', async () => {
    seed()
    const w = mount(CalendarView)
    await nextTick()
    // 默认月视图，先切回日视图
    await w.findAll('.seg-item')[0].trigger('click')
    await nextTick()
    expect(w.findAll('.all-day-item').length).toBe(1)
    expect(w.find('.all-day-item').text()).toContain('全天安排')
    const points = w.findAll('.time-item.point')
    expect(points).toHaveLength(1)
    expect(points[0].text()).toContain('上午会议')
    expect(w.findAll('.time-item.bar.range').length).toBe(1)
    expect(w.findAll('.time-item.bar.session').length).toBe(1)
    w.unmount()
  })

  it('默认进入月视图；周视图 7 列、月视图 42 格且聚合任务', async () => {
    seed()
    const w = mount(CalendarView)
    await nextTick()
    // 默认即月视图
    expect(w.findAll('.cell')).toHaveLength(42)
    const segs = w.findAll('.seg-item')
    await segs[1].trigger('click') // 周
    await nextTick()
    expect(w.findAll('.day-col')).toHaveLength(7)
    await segs[2].trigger('click') // 月
    await nextTick()
    expect(w.findAll('.cell')).toHaveLength(42)
    expect(w.text()).toContain('上午会议')
    w.unmount()
  })

  it('任务板块背景跟随标签颜色（日视图与月视图）', async () => {
    const d = today0()
    const tg = store.addTag({ name: '工作', color: '#E11D48' })
    store.addTodo({ title: '带标签全天', timeType: 'date', startAt: d, tagIds: [tg.id] })
    const w = mount(CalendarView)
    await nextTick()
    // 先看日视图
    await w.findAll('.seg-item')[0].trigger('click')
    await nextTick()
    const allDay = w.find('.all-day-item')
    expect(allDay.attributes('style')).toContain('rgb(225, 29, 72)')
    expect(allDay.classes()).toContain('tag-colored')
    // 月视图
    const segs = w.findAll('.seg-item')
    await segs[2].trigger('click')
    await nextTick()
    const bar = w.find('.span-bar.todo')
    expect(bar.attributes('style')).toContain('rgb(225, 29, 72)')
    w.unmount()
  })

  it('点时间轴空白打开预填当前时刻的新建任务', async () => {
    const w = mount(CalendarView)
    await nextTick()
    await w.findAll('.seg-item')[0].trigger('click') // 切到日视图
    await nextTick()
    const body = w.find('.day-col .body')
    await body.trigger('click')
    await nextTick()
    const panel = document.body.querySelector('.modal-panel')
    expect(panel).toBeTruthy()
    expect(panel.textContent).toContain('新建任务')
    // 时间类型应落在“时间点”并带默认 9:00 时间
    const segItems = panel.querySelectorAll('.seg-item')
    expect(segItems[2].classList.contains('active')).toBe(true)
    w.unmount()
  })

  it('月视图点击长条打开编辑弹层并回显标题（可改起止时间）', async () => {
    seed()
    const w = mount(CalendarView)
    await nextTick()
    // 默认月视图：点击任务长条
    const bar = w.findAll('.span-bar.todo').find((b) => b.text().includes('上午会议'))
    await bar.trigger('click')
    await nextTick()
    const panel = document.body.querySelector('.modal-panel')
    expect(panel.textContent).toContain('编辑任务')
    const titleInput = panel.querySelector('input.input')
    expect(titleInput.value).toBe('上午会议')
    // 表单里可编辑起止时间
    expect(panel.textContent).toContain('时间')
    w.unmount()
  })

  it('日视图翻页标题随之变化，今天按钮返回', async () => {
    const w = mount(CalendarView)
    await nextTick()
    await w.findAll('.seg-item')[0].trigger('click') // 切到日视图
    await nextTick()
    const todayText = fmtDate(Date.now())
    expect(w.find('.cal-title').text()).toContain(todayText)
    const navBtns = w.findAll('.nav button')
    await navBtns[0].trigger('click') // prev
    await nextTick()
    expect(w.find('.cal-title').text()).toContain(fmtDate(addDaysTs(Date.now(), -1)))
    await navBtns[1].trigger('click') // 今天
    await nextTick()
    expect(w.find('.cal-title').text()).toContain(fmtDate(Date.now()))
    w.unmount()
  })

  it('月视图点某天打开该天新建', async () => {
    const w = mount(CalendarView)
    await nextTick()
    const todayCell = w.findAll('.cell').find((c) => c.classes().includes('today'))
    await todayCell.trigger('click')
    await nextTick()
    const panel = document.body.querySelector('.modal-panel')
    expect(panel).toBeTruthy()
    expect(panel.textContent).toContain('新建任务')
    w.unmount()
  })
})

describe('月视图跨期长条', () => {
  const today0 = () => startOfDayTs(Date.now())

  it('跨多天任务在同一周内渲染为单个长条（不按天拆分）', async () => {
    const d = today0()
    const ws = startOfWeekTs(d)
    // 同一周内跨 3 天（周一 9:00 ~ 周三 12:00）
    store.addTodo({ title: '跨期任务', timeType: 'range', startAt: ws + 9 * 3600000, endAt: addDaysTs(ws, 2) + 12 * 3600000 })
    const w = mount(CalendarView)
    await nextTick()
    const bars = w.findAll('.span-bar.todo')
    expect(bars).toHaveLength(1) // 一条长条，不分天重复
    expect(bars[0].text()).toContain('跨期任务')
    // 宽度覆盖 3 格（3/7 ≈ 42.857%）
    expect(bars[0].attributes('style')).toContain('42.857')
    w.unmount()
  })

  it('月视图提示卡：跨天任务超过结束日才显示「已逾期」', async () => {
    const d = today0()
    store.addTodo({ title: '昨天结束的跨天任务', timeType: 'range', startAt: addDaysTs(d, -3) + 9 * 3600000, endAt: addDaysTs(d, -1) + 18 * 3600000 })
    const w = mount(CalendarView)
    await nextTick()
    const bar = w.findAll('.span-bar.todo').find((b) => b.text().includes('昨天结束的跨天任务'))
    await bar.trigger('mouseenter', { clientX: 100, clientY: 120 })
    await nextTick()
    const tip = document.querySelector('.cal-tip')
    expect(tip).toBeTruthy()
    expect(tip.textContent).toContain('已逾期')
    w.unmount()
  })

  it('单日任务各自一条，跨周任务按周分两段（日历固有分段）', async () => {
    const d = today0()
    const ws = startOfWeekTs(d)
    store.addTodo({ title: '单日', timeType: 'date', startAt: ws })
    // 跨周：本周日 ~ 下周一
    store.addTodo({ title: '跨周任务', timeType: 'range', startAt: addDaysTs(ws, 6) + 9 * 3600000, endAt: addDaysTs(ws, 7) + 12 * 3600000 })
    const w = mount(CalendarView)
    await nextTick()
    const bars = w.findAll('.span-bar.todo')
    expect(bars.filter((b) => b.text().includes('单日'))).toHaveLength(1)
    expect(bars.filter((b) => b.text().includes('跨周任务'))).toHaveLength(2)
    w.unmount()
  })

  it('悬浮长条显示简要信息，长按同样可触发', async () => {
    vi.useFakeTimers()
    try {
      const d = today0()
      const tg = store.addTag({ name: '工作', color: '#E11D48' })
      const p = store.addProject({ name: '官网项目' })
      store.addTodo({ title: '带信息的任务', timeType: 'range', startAt: d, endAt: addDaysTs(d, 1) + 3600000, tagIds: [tg.id], projectId: p.id, priority: 'high' })
      const w = mount(CalendarView)
      await nextTick()
      const bar = w.find('.span-bar.todo')
      // 桌面悬浮
      await bar.trigger('mouseenter', { clientX: 100, clientY: 120 })
      await nextTick()
      let tip = document.querySelector('.cal-tip')
      expect(tip).toBeTruthy()
      expect(tip.textContent).toContain('带信息的任务')
      expect(tip.textContent).toContain('工作')
      expect(tip.textContent).toContain('官网项目')
      expect(tip.textContent).toContain('高')
      await bar.trigger('mouseleave')
      await nextTick()
      expect(document.querySelector('.cal-tip')).toBeFalsy()
      // 移动端长按
      bar.element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 60, clientY: 70, bubbles: true }))
      vi.advanceTimersByTime(500)
      await nextTick()
      tip = document.querySelector('.cal-tip')
      expect(tip).toBeTruthy()
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})
