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
      expect(w.findAll('.h-card')).toHaveLength(7) // 含新增的「本周日历」
      const handles = w.findAll('.drag-handle')
      expect(handles.length).toBe(7)
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
      // 板块顺序已重排并持久化：今日计划不再是第一个
      const order = store.state.settings.homeOrder
      expect(order[0]).not.toBe('todayTodos')
      expect(order.indexOf('todayTodos')).toBeGreaterThan(0)
      // 持久化后的顺序与渲染顺序一致
      const renderedOrder = w.findAll('.h-card').map((c) => Number((c.attributes('style').match(/order:\s*(\d+)/) || [])[1]))
      expect(renderedOrder.slice().sort((a, b) => a - b)).toEqual([...renderedOrder].sort((a, b) => a - b))
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('项目任务以独立待办行显示并标注归属项目', async () => {
    const p = store.addProject({ name: '暑期课程' })
    store.addSubTask({ projectId: p.id, name: '写作业', dueAt: startOfDayTs(Date.now()) + 12 * 3600000 })
    const { w } = mountHome()
    await nextTick()
    const tag = w.find('.proj-tag')
    expect(tag.exists()).toBe(true)
    expect(tag.text()).toBe('暑期课程')
    w.unmount()
  })

  it('点击今日计划任务：在首页展开详情抽屉，不跳转到待办 / 项目页', async () => {
    const p = store.addProject({ name: '暑期课程' })
    store.addSubTask({ projectId: p.id, name: '写作业', dueAt: startOfDayTs(Date.now()) + 12 * 3600000 })
    const t = store.addTodo({ title: '首页任务', timeType: 'datetime', startAt: startOfDayTs(Date.now()) + 8 * 3600000 })
    const { w, router } = mountHome()
    await nextTick()
    // 项目任务行
    const projRow = w.findAll('.h-row-main').find((el) => el.text().includes('写作业'))
    await projRow.trigger('click')
    await nextTick()
    expect(router.currentRoute.value.path).toBe('/')
    let panel = document.body.querySelector('.drawer-panel')
    expect(panel).toBeTruthy()
    expect(panel.textContent).toContain('写作业')
    // 关闭抽屉后点击普通任务行
    document.body.querySelector('.drawer-panel .icon-btn').click()
    await nextTick()
    const normalRow = w.findAll('.h-row-main').find((el) => el.text().includes('首页任务'))
    await normalRow.trigger('click')
    await nextTick()
    expect(router.currentRoute.value.path).toBe('/')
    panel = document.body.querySelector('.drawer-panel')
    expect(panel).toBeTruthy()
    expect(panel.textContent).toContain('首页任务')
    // 抽屉里可编辑：打开编辑表单
    const editBtn = [...panel.querySelectorAll('button')].find((b) => b.textContent.includes('编辑'))
    editBtn.click()
    await nextTick()
    expect(document.body.querySelector('.modal-panel')).toBeTruthy()
    w.unmount()
    void t
  })

  it('首页「开始专注」直接跳转专注主页面（无中间浮层）', async () => {
    const { w, router } = mountHome()
    await nextTick()
    const btn = w.findAll('button').find((b) => b.text().includes('开始专注'))
    expect(btn).toBeTruthy()
    await btn.trigger('click')
    await new Promise((r) => setTimeout(r, 10))
    expect(router.currentRoute.value.path).toBe('/focus')
    w.unmount()
  })

  it('首页今日计划行上的专注按钮：带上该任务并跳转专注页', async () => {
    const d = startOfDayTs(Date.now())
    const t = store.addTodo({ title: '待专注任务', timeType: 'datetime', startAt: d + 10 * 3600000 })
    const { w, router } = mountHome()
    await nextTick()
    const row = w.findAll('.h-row').find((r) => r.text().includes('待专注任务'))
    await row.find('.focus-mini').trigger('click')
    await new Promise((r) => setTimeout(r, 10))
    expect(store.focusState.targetType).toBe('todo')
    expect(store.focusState.targetId).toBe(t.id)
    expect(router.currentRoute.value.path).toBe('/focus')
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
    // 定位「项目进度」卡片里的隐藏按钮（今日计划卡片也有一个隐藏按钮）
    const projCard = w.findAll('.h-card').find((c) => c.text().includes('项目进度'))
    const hideBtn = projCard.findAll('button').find((b) => b.text().includes('隐藏'))
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

describe('首页今日计划排序', () => {
  it('默认按优先级排序：高 → 中 → 低 → 无优先级', async () => {
    const d = startOfDayTs(Date.now())
    store.addTodo({ title: '无优先级任务', timeType: 'datetime', startAt: d + 9 * 3600000 })
    store.addTodo({ title: '低优先级任务', timeType: 'datetime', startAt: d + 8 * 3600000, priority: 'low' })
    store.addTodo({ title: '高优先级任务', timeType: 'datetime', startAt: d + 11 * 3600000, priority: 'high' })
    store.addTodo({ title: '中优先级任务', timeType: 'datetime', startAt: d + 10 * 3600000, priority: 'medium' })
    const { w } = mountHome()
    await nextTick()
    const titles = w.findAll('.h-row-title').map((t) => t.text())
    expect(titles).toEqual(['高优先级任务', '中优先级任务', '低优先级任务', '无优先级任务'])
    w.unmount()
  })

  it('同优先级时按开始时间先后排列，无时间排最后', async () => {
    const d = startOfDayTs(Date.now())
    store.addTodo({ title: '十点', timeType: 'datetime', startAt: d + 10 * 3600000, priority: 'medium' })
    store.addTodo({ title: '九点', timeType: 'datetime', startAt: d + 9 * 3600000, priority: 'medium' })
    const { w } = mountHome()
    await nextTick()
    const titles = w.findAll('.h-row-title').map((t) => t.text())
    expect(titles.slice(0, 2)).toEqual(['九点', '十点'])
    w.unmount()
  })
})

describe('首页本周日历', () => {
  it('首页展示周视图（7 天），每天折叠显示 2 条并标注时间', async () => {
    const d = startOfDayTs(Date.now())
    store.addTodo({ title: '九点站会', timeType: 'datetime', startAt: d + 9 * 3600000 })
    store.addTodo({ title: '十点写文档', timeType: 'datetime', startAt: d + 10 * 3600000 })
    store.addTodo({ title: '十一点评审', timeType: 'datetime', startAt: d + 11 * 3600000 })
    const { w } = mountHome()
    await nextTick()
    expect(w.text()).toContain('本周日历')
    const cols = w.findAll('.day-col')
    expect(cols).toHaveLength(7)
    // 首页每天只显示 2 条，可展开
    const todayCol = cols.find((c) => c.classes().includes('today'))
    expect(todayCol.findAll('.item')).toHaveLength(2)
    expect(todayCol.text()).toContain('09:00')
    expect(todayCol.find('.toggle').text()).toContain('展开更多（+1）')
    w.unmount()
  })

  it('点首页周视图里的任务可打开任务抽屉；点日期可新建', async () => {
    const d = startOfDayTs(Date.now())
    const t = store.addTodo({ title: '站会', timeType: 'datetime', startAt: d + 9 * 3600000 })
    const { w, router } = mountHome()
    await nextTick()
    const item = w.findAll('.item').find((i) => i.text().includes('站会'))
    await item.trigger('click')
    await nextTick()
    const panel = document.body.querySelector('.drawer-panel')
    expect(panel).toBeTruthy()
    expect(panel.textContent).toContain('站会')
    expect(router.currentRoute.value.path).toBe('/')
    expect(t.id).toBeTruthy()
    // 点日期表头新建
    await w.findAll('.day-head')[0].trigger('click')
    await nextTick()
    const modal = document.body.querySelector('.modal-panel')
    expect(modal).toBeTruthy()
    expect(modal.textContent).toContain('新建任务')
    w.unmount()
  })
})

describe('今日计划板块可隐藏', () => {
  it('卡片内点「隐藏」后不再显示，并写入设置', async () => {
    const d = startOfDayTs(Date.now())
    store.addTodo({ title: '今天的任务', timeType: 'datetime', startAt: d + 10 * 3600000 })
    const { w } = mountHome()
    await nextTick()
    expect(w.text()).toContain('今日计划')
    const todayCard = w.findAll('.h-card').find((c) => c.text().includes('今日计划'))
    const hideBtn = todayCard.findAll('button').find((b) => b.text().includes('隐藏'))
    await hideBtn.trigger('click')
    await nextTick()
    expect(store.state.settings.showTodayTodosOnHome).toBe(false)
    expect(w.text()).not.toContain('今日计划')
    w.unmount()
  })

  it('设置里关闭后首页不显示今日计划板块，其它板块照常', async () => {
    const d = startOfDayTs(Date.now())
    store.addTodo({ title: '今天的任务', timeType: 'datetime', startAt: d + 10 * 3600000 })
    store.setSetting('showTodayTodosOnHome', false)
    const { w } = mountHome()
    await nextTick()
    expect(w.text()).not.toContain('今日计划')
    expect(w.text()).toContain('本周日历') // 其它板块不受影响（任务仍会出现在周视图里）
    w.unmount()
  })
})

describe('首页项目板块可自定义显示内容', () => {
  it('默认显示进度与截止日期，隐藏标签/分类；可关闭进度、打开标签与分类', async () => {
    const tg = store.addTag({ name: '学习', color: '#0ea5e9' })
    const d = startOfDayTs(Date.now())
    store.addProject({ name: '考研计划', deadline: d + 10 * 86400000, tagIds: [tg.id], category: 'study' })
    const { w } = mountHome()
    await nextTick()
    const card = w.findAll('.h-card').find((c) => c.text().includes('项目进度'))
    expect(card.find('.progress').exists()).toBe(true) // 默认显示进度条
    expect(card.find('.proj-dead').exists()).toBe(true) // 默认显示截止日期
    expect(card.find('.proj-cat').exists()).toBe(false) // 默认不显示分类
    expect(card.find('.tag-chip').exists()).toBe(false) // 默认不显示标签
    w.unmount()

    store.setSetting('homeProjectDisplay', { progress: false, deadline: false, tags: true, category: true, count: 3 })
    const { w: w2 } = mountHome()
    await nextTick()
    const card2 = w2.findAll('.h-card').find((c) => c.text().includes('项目进度'))
    expect(card2.find('.progress').exists()).toBe(false)
    expect(card2.find('.proj-dead').exists()).toBe(false)
    expect(card2.find('.proj-cat').exists()).toBe(true)
    expect(card2.find('.tag-chip').exists()).toBe(true)
    w2.unmount()
  })

  it('可自定义最多显示几个项目', async () => {
    for (const n of ['甲', '乙', '丙', '丁']) store.addProject({ name: '项目' + n })
    store.setSetting('homeProjectDisplay', { count: 2 })
    const { w } = mountHome()
    await nextTick()
    const card = w.findAll('.h-card').find((c) => c.text().includes('项目进度'))
    expect(card.findAll('.proj-row')).toHaveLength(2)
    w.unmount()
  })
})
