import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { startOfDayTs, addDaysTs, fmtDate, DAY_MS } from '../src/utils/date.js'
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
    expect(w.findAll('.all-day-item').length).toBe(1)
    expect(w.find('.all-day-item').text()).toContain('全天安排')
    const points = w.findAll('.time-item.point')
    expect(points).toHaveLength(1)
    expect(points[0].text()).toContain('上午会议')
    expect(w.findAll('.time-item.bar.range').length).toBe(1)
    expect(w.findAll('.time-item.bar.session').length).toBe(1)
    w.unmount()
  })

  it('周视图 7 列、月视图 42 格且聚合任务', async () => {
    seed()
    const w = mount(CalendarView)
    await nextTick()
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
    const allDay = w.find('.all-day-item')
    expect(allDay.attributes('style')).toContain('rgb(225, 29, 72)')
    expect(allDay.classes()).toContain('tag-colored')
    // 月视图
    const segs = w.findAll('.seg-item')
    await segs[2].trigger('click')
    await nextTick()
    const cellTodo = w.find('.cell-item.todo')
    expect(cellTodo.attributes('style')).toContain('rgb(225, 29, 72)')
    w.unmount()
  })

  it('点时间轴空白打开预填当前时刻的新建任务', async () => {
    const w = mount(CalendarView)
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

  it('点击任务条打开编辑弹层并回显标题', async () => {
    seed()
    const w = mount(CalendarView)
    await nextTick()
    await w.find('.time-item.point').trigger('click')
    await nextTick()
    const panel = document.body.querySelector('.modal-panel')
    expect(panel.textContent).toContain('编辑任务')
    const titleInput = panel.querySelector('input.input')
    expect(titleInput.value).toBe('上午会议')
    w.unmount()
  })

  it('日视图翻页标题随之变化，今天按钮返回', async () => {
    const w = mount(CalendarView)
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
    const segs = w.findAll('.seg-item')
    await segs[2].trigger('click')
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
