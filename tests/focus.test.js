import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import FocusTimer from '../src/components/focus/FocusTimer.vue'
import FocusOverlay from '../src/components/focus/FocusOverlay.vue'
import FocusView from '../src/views/FocusView.vue'
import ConfirmDialog from '../src/components/ui/ConfirmDialog.vue'
import { settleConfirm, confirmState } from '../src/ui.js'
import { startOfDayTs, DAY_MS } from '../src/utils/date.js'

function resetFocus() {
  const f = store.focusState
  f.visible = false
  f.phase = 'idle'
  f.mode = 'pomodoro'
  f.targetType = 'none'
  f.targetId = null
  f.runStartTs = 0
  f.accumMs = 0
  f.breakStartTs = 0
}

beforeEach(() => {
  store._replace(defaultState())
  resetFocus()
})

afterEach(() => {
  resetFocus()
  confirmState.visible = false
  confirmState.resolve = null
  document.body.innerHTML = ''
})

describe('专注页番茄时长调节', () => {
  it('右上角显示当前番茄时长，可直接调整', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div/>' } },
        { path: '/focus', component: { template: '<div/>' } },
        { path: '/projects/:id', component: { template: '<div/>' } },
        { path: '/todos', component: { template: '<div/>' } },
      ],
    })
    router.push('/focus')
    const w = mount(FocusView, { global: { plugins: [router] } })
    await nextTick()
    expect(store.state.settings.pomodoroFocusMin).toBe(25)
    expect(w.find('.pomo-btn').text()).toContain('番茄 25 分钟')
    await w.find('.pomo-btn').trigger('click')
    await nextTick()
    const chip = [...document.querySelectorAll('.pomo-chip')].find((c) => c.textContent.includes('45 分钟'))
    chip.click()
    await nextTick()
    expect(store.state.settings.pomodoroFocusMin).toBe(45)
    expect(w.find('.pomo-btn').text()).toContain('番茄 45 分钟')
    w.unmount()
  })
})

describe('FocusTimer 状态映射', () => {
  it('idle 显示计划时长与开始按钮', () => {
    const w = mount(FocusTimer)
    expect(w.text()).toContain('25:00')
    expect(w.text()).toContain('开始番茄')
    expect(w.find('.big-time').exists()).toBe(true)
    w.unmount()
  })

  it('点击开始进入 run，可暂停与继续', async () => {
    const w = mount(FocusTimer)
    const startBtn = w.findAll('button').find((b) => b.text().includes('开始番茄'))
    await startBtn.trigger('click')
    expect(store.focusState.phase).toBe('run')
    await nextTick()
    expect(w.text()).toContain('专注中')
    const pauseBtn = w.findAll('button').find((b) => b.text().includes('暂停'))
    await pauseBtn.trigger('click')
    expect(store.focusState.phase).toBe('pause')
    await nextTick()
    expect(w.text()).toContain('已暂停')
    const resumeBtn = w.findAll('button').find((b) => b.text().includes('继续'))
    await resumeBtn.trigger('click')
    expect(store.focusState.phase).toBe('run')
    w.unmount()
  })

  it('空闲时切换自由计时模式', async () => {
    const w = mount(FocusTimer)
    const segs = w.findAll('.seg-item')
    await segs[1].trigger('click')
    expect(store.focusState.mode).toBe('free')
    await nextTick()
    expect(w.text()).toContain('自由计时，随时开始')
    const startBtn = w.findAll('button').find((b) => b.text().includes('开始计时'))
    expect(startBtn).toBeTruthy()
    w.unmount()
  })

  it('运行中切换模式被拒绝', async () => {
    store.startFocusRun({ mode: 'pomodoro' })
    const w = mount(FocusTimer)
    const segs = w.findAll('.seg-item')
    await segs[1].trigger('click')
    expect(store.focusState.mode).toBe('pomodoro')
    w.unmount()
  })

  it('绑定任务后显示任务名', () => {
    const t = store.addTodo({ title: '写周报' })
    store.openFocus({ targetType: 'todo', targetId: t.id })
    const w = mount(FocusTimer)
    expect(w.text()).toContain('写周报')
    w.unmount()
  })

  it('手动结束弹确认并回到 idle', async () => {
    store.startFocusRun({ mode: 'free' })
    mount(ConfirmDialog)
    const w = mount(FocusTimer)
    await nextTick()
    const endBtn = w.findAll('button').find((b) => b.text().includes('结束'))
    await endBtn.trigger('click')
    await nextTick()
    expect(document.body.querySelector('.confirm-panel')).toBeTruthy()
    settleConfirm(true)
    await new Promise((r) => setTimeout(r, 10))
    expect(store.focusState.phase).toBe('idle')
    w.unmount()
  })
})

describe('FocusOverlay 浮层', () => {
  it('visible 时全屏展示计时，可收起', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div/>' } }, { path: '/focus', component: { template: '<div/>' } }] })
    const w = mount(FocusOverlay, { global: { plugins: [router] } })
    expect(document.body.querySelector('.focus-overlay')).toBeNull()
    store.openFocus({ mode: 'pomodoro' })
    await nextTick()
    expect(document.body.querySelector('.focus-overlay')).toBeTruthy()
    expect(document.body.textContent).toContain('开始番茄')
    const hideBtn = document.body.querySelectorAll('.pill-btn')
    hideBtn[1].click()
    await nextTick()
    expect(store.focusState.visible).toBe(false)
    expect(document.body.querySelector('.focus-overlay')).toBeNull()
    w.unmount()
  })

  it('右上角可进入专注页', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div/>' } }, { path: '/focus', component: { template: '<div/>' } }] })
    router.push('/')
    const w = mount(FocusOverlay, { global: { plugins: [router] } })
    store.openFocus({})
    await nextTick()
    const goBtn = document.body.querySelectorAll('.pill-btn')[0]
    goBtn.click()
    await new Promise((r) => setTimeout(r, 10))
    expect(router.currentRoute.value.path).toBe('/focus')
    expect(store.focusState.visible).toBe(false)
    w.unmount()
  })
})

describe('FocusView 专注页', () => {
  function mountView() {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div/>' } }] })
    router.push('/')
    return mount(FocusView, { global: { plugins: [router] } })
  }

  it('今日统计与会话列表', async () => {
    const today = startOfDayTs(Date.now())
    store.addSession({ mode: 'pomodoro', targetType: 'none', startAt: today + 3600000, endAt: today + 3700000, durationMin: 25 })
    store.addSession({ mode: 'free', targetType: 'none', startAt: today + 7200000, endAt: today + 7300000, durationMin: 30 })
    const w = mountView()
    await nextTick()
    expect(w.text()).toContain('今日次数')
    expect(w.text()).toContain('番茄')
    expect(w.text()).toContain('自由')
    expect(w.text()).toContain('55')
    w.unmount()
  })

  it('选择任务面板绑定目标', async () => {
    const t = store.addTodo({ title: '待专注任务' })
    const w = mountView()
    const pickBtn = w.findAll('button').find((b) => b.text().includes('选择要专注的任务'))
    await pickBtn.trigger('click')
    await nextTick()
    const modal = document.body.querySelector('.modal-panel')
    expect(modal.textContent).toContain('待专注任务')
    const item = [...modal.querySelectorAll('.picker-item')].find((b) => b.textContent.includes('待专注任务'))
    item.click()
    await nextTick()
    expect(store.focusState.targetType).toBe('todo')
    expect(store.focusState.targetId).toBe(t.id)
    w.unmount()
  })

  it('运行中禁止换目标', async () => {
    store.startFocusRun({ mode: 'pomodoro' })
    const w = mountView()
    await nextTick()
    const pickBtn = w.findAll('button').find((b) => b.text().includes('选择要专注的任务'))
    expect(pickBtn.attributes('disabled')).toBeDefined()
    w.unmount()
  })
})
