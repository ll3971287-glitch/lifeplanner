import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { startOfDayTs, startOfWeekTs, DAY_MS } from '../src/utils/date.js'
import HomeView from '../src/views/HomeView.vue'
import { confirmState } from '../src/ui.js'

beforeEach(() => {
  store._replace(defaultState())
  const f = store.focusState
  f.visible = false
  f.phase = 'idle'
})

afterEach(() => {
  confirmState.visible = false
  confirmState.resolve = null
  document.body.innerHTML = ''
})

function mountHome() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/todos', component: { template: '<div/>' } },
      { path: '/projects/:id', component: { template: '<div/>' } },
      { path: '/focus', component: { template: '<div/>' } },
      { path: '/checkins/:id', component: { template: '<div/>' } },
      { path: '/reviews', component: { template: '<div/>' } },
      { path: '/tags', component: { template: '<div/>' } },
    ],
  })
  router.push('/')
  return { w: mount(HomeView, { global: { plugins: [router] } }), router }
}

describe('首页摘要', () => {
  it('展示今日任务与项目任务（项目任务=普通待办，勾选回写项目）', async () => {
    const d = startOfDayTs(Date.now())
    store.addTodo({ title: '今天要办的事', timeType: 'datetime', startAt: d + 10 * 3600000 })
    const p = store.addProject({ name: '大项目' })
    const sub = store.addSubTask({ projectId: p.id, name: '钉在首页的子任务', dueAt: d + 11 * 3600000 })
    const { w } = mountHome()
    await nextTick()
    expect(w.text()).toContain('今天要办的事')
    expect(w.text()).toContain('钉在首页的子任务')
    expect(w.text()).toContain('大项目')
    // 找到该项目任务行的勾选并点击
    const subRow = w.findAll('.h-row').find((r) => r.text().includes('钉在首页的子任务'))
    await subRow.find('.check').trigger('click')
    await nextTick()
    const todo = store.state.todos.find((x) => x.id === sub.id)
    expect(todo.completed).toBe(true)
    expect(todo.completedAt).not.toBeNull()
    // 完成后该行从今日计划中消失
    expect(w.findAll('.h-row').find((r) => r.text().includes('钉在首页的子任务'))).toBeUndefined()
    w.unmount()
  })

  it('今日任务行同时显示普通待办的标签与项目任务的项目名', async () => {
    const d = startOfDayTs(Date.now())
    const tg = store.addTag({ name: '学习', color: '#0EA5E9' })
    store.addTodo({ title: '带标签任务', timeType: 'date', startAt: d, tagIds: [tg.id] })
    const p = store.addProject({ name: '某个项目' })
    store.addSubTask({ projectId: p.id, name: '项目小任务', dueAt: d + 9 * 3600000, tagIds: [tg.id] })
    const { w } = mountHome()
    await nextTick()
    expect(w.text()).toContain('带标签任务')
    expect(w.text()).toContain('学习') // 普通待办的标签 chip
    expect(w.text()).toContain('某个项目') // 项目任务的归属
    w.unmount()
  })

  it('勾选今日待办任务完成', async () => {
    const d = startOfDayTs(Date.now())
    const t = store.addTodo({ title: '完成它', timeType: 'date', startAt: d })
    const { w } = mountHome()
    await nextTick()
    await w.find('.h-row .check').trigger('click')
    await nextTick()
    expect(store.state.todos.find((x) => x.id === t.id).completed).toBe(true)
    // 完成后行直接消失
    expect(w.findAll('.h-row').find((r) => r.text().includes('完成它'))).toBeUndefined()
    w.unmount()
  })

  it('长按把手拖动可调整首页板块顺序并持久化', async () => {
    vi.useFakeTimers()
    try {
      const { w } = mountHome()
      await nextTick()
      expect(w.findAll('.h-card')).toHaveLength(6)
      const handles = w.findAll('.drag-handle')
      expect(handles.length).toBe(6)
      handles[0].element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }))
      vi.advanceTimersByTime(500)
      await nextTick()
      window.dispatchEvent(new MouseEvent('pointermove', { clientY: 400 }))
      await nextTick()
      const firstCard = w.findAll('.h-card')[0]
      expect(firstCard.attributes('style')).toContain('translateY(')
      // 拖动中：其它卡片不移动、顺序未持久化
      expect(store.state.settings.homeOrder[0]).toBe('todayTodos')
      window.dispatchEvent(new MouseEvent('pointerup'))
      await nextTick()
      // 板块顺序已重排：今日计划被移到蓝图之后，且持久化到 settings
      expect(store.state.settings.homeOrder[0]).toBe('blueprints')
      expect(w.findAll('.h-card')[0].attributes('style')).toContain('order: 2')
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('项目任务以独立待办行显示并标注归属项目，可跳转项目', async () => {
    const p = store.addProject({ name: '暑期课程' })
    store.addSubTask({ projectId: p.id, name: '写作业', dueAt: startOfDayTs(Date.now()) + 12 * 3600000 })
    const { w, router } = mountHome()
    await nextTick()
    const tag = w.find('.proj-tag')
    expect(tag.exists()).toBe(true)
    expect(tag.text()).toBe('暑期课程')
    const rowMain = w.findAll('.h-row-main').find((el) => el.text().includes('写作业'))
    await rowMain.trigger('click')
    await new Promise((r) => setTimeout(r, 10))
    expect(router.currentRoute.value.path).toBe(`/projects/${p.id}`)
    w.unmount()
  })

  it('今日计划板块可按 本周/本月 切换展示范围任务', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-09T12:00:00')) // 固定周三：明天的任务必属于本周且本月
    try {
      const todayD = startOfDayTs(Date.now())
      store.addTodo({ title: '今天的事', timeType: 'date', startAt: todayD })
      store.addTodo({ title: '明天的事', timeType: 'date', startAt: todayD + DAY_MS })
      const { w } = mountHome()
      await nextTick()
      const planCard = () => w.findAll('.h-card').find((c) => c.text().includes('今日计划'))
      expect(planCard().text()).toContain('今天的事')
      expect(planCard().text()).not.toContain('明天的事')
      const segs = w.findAll('.seg-item')
      const weekBtn = segs.find((b) => b.text() === '本周')
      await weekBtn.trigger('click')
      await nextTick()
      expect(planCard().text()).toContain('明天的事')
      const monthBtn = segs.find((b) => b.text() === '本月')
      await monthBtn.trigger('click')
      await nextTick()
      expect(planCard().text()).toContain('明天的事')
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('项目进度板块可一键隐藏并写入设置', async () => {
    const p = store.addProject({ name: '要隐藏的项目' })
    const { w } = mountHome()
    await nextTick()
    expect(w.text()).toContain('要隐藏的项目')
    const hideBtn = w.findAll('button').find((b) => b.text().includes('隐藏'))
    await hideBtn.trigger('click')
    await nextTick()
    expect(store.state.settings.showProjectsOnHome).toBe(false)
    expect(w.text()).not.toContain('要隐藏的项目')
    expect(w.text()).not.toContain('项目进度')
    w.unmount()
  })

  it('项目进度卡片显示进度', async () => {
    const p = store.addProject({ name: '学习项目' })
    const s1 = store.addSubTask({ projectId: p.id, name: 'a' })
    const s2 = store.addSubTask({ projectId: p.id, name: 'b' })
    store.cycleSubTaskStatus(s1.id)
    const { w } = mountHome()
    await nextTick()
    expect(w.text()).toContain('学习项目')
    expect(w.text()).toContain('50%')
    w.unmount()
  })

  it('专注统计与运行中按钮', async () => {
    const d = startOfDayTs(Date.now())
    store.addSession({ mode: 'pomodoro', targetType: 'none', startAt: d + 3600000, endAt: d + 3700000, durationMin: 25 })
    const { w } = mountHome()
    await nextTick()
    expect(w.text()).toContain('25m')
    expect(w.text()).toContain('1 次')
    const startBtn = w.findAll('button').find((b) => b.text().includes('开始专注'))
    expect(startBtn).toBeTruthy()
    w.unmount()
  })

  it('今日打卡快捷打卡 +1', async () => {
    const c = store.addCheckin({ name: '喝水', unit: '杯', dailyTargetCount: 3 })
    const { w } = mountHome()
    await nextTick()
    expect(w.text()).toContain('0/3 杯')
    await w.find('.checkin-mini').trigger('click')
    await nextTick()
    expect(store.state.checkinRecords).toHaveLength(1)
    expect(w.text()).toContain('1/3 杯')
    w.unmount()
  })

  it('即将到期显示 48h 内任务', async () => {
    store.addTodo({ title: '两小时后交表', timeType: 'datetime', startAt: Date.now() + 2 * 3600000 })
    const { w } = mountHome()
    await nextTick()
    expect(w.text()).toContain('两小时后交表')
    w.unmount()
  })

  it('未写日复盘时提示，写后变化', async () => {
    const { w } = mountHome()
    await nextTick()
    expect(w.text()).toContain('今天还没写日复盘')
    store.addReview({ type: 'day', periodDate: startOfDayTs(Date.now()), fields: { summary: 'x' } })
    await nextTick()
    expect(w.text()).toContain('今天的日复盘已完成')
    w.unmount()
  })
})
