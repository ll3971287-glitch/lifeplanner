import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { startOfDayTs, DAY_MS, addDaysTs } from '../src/utils/date.js'
import CheckinFormModal from '../src/components/checkin/CheckinFormModal.vue'
import CheckinRecordModal from '../src/components/checkin/CheckinRecordModal.vue'
import CheckinsView from '../src/views/CheckinsView.vue'
import CheckinDetailView from '../src/views/CheckinDetailView.vue'
import LineChart from '../src/components/checkin/charts/LineChart.vue'
import Heatmap from '../src/components/checkin/charts/Heatmap.vue'
import GanttChart from '../src/components/checkin/charts/GanttChart.vue'
import { confirmState } from '../src/ui.js'

beforeEach(() => {
  store._replace(defaultState())
})

afterEach(() => {
  confirmState.visible = false
  confirmState.resolve = null
  document.body.innerHTML = ''
})

describe('CheckinFormModal', () => {
  it('新建次数型打卡项目（永久）', async () => {
    const w = mount(CheckinFormModal)
    await w.find('input.input').setValue('喝水')
    const inputs = w.findAll('input.input')
    await inputs[2].setValue('8') // dailyTargetCount（unit、name、dailyTargetCount 三个 .input）
    await w.find('.btn-primary').trigger('click')
    expect(store.state.checkins).toHaveLength(1)
    const c = store.state.checkins[0]
    expect(c.name).toBe('喝水')
    expect(c.dailyTargetCount).toBe(8)
    expect(c.fixedDurationMin).toBeNull()
    expect(c.startDate).toBeNull()
    expect(c.endDate).toBeNull()
  })

  it('新建时长型（开启固定时长 + 结束日期）', async () => {
    const w = mount(CheckinFormModal)
    await w.find('input.input').setValue('阅读')
    // 打开固定时长开关
    await w.find('.switch').trigger('click')
    const inputs = w.findAll('input.input')
    await inputs[2].setValue('30') // 时长 input（name/unit/时长）
    const dates = w.findAll('input[type="date"]')
    dates[1].element.value = '2026-12-31'
    await dates[1].trigger('change')
    await w.find('.btn-primary').trigger('click')
    const c = store.state.checkins[0]
    expect(c.fixedDurationMin).toBe(30)
    expect(c.rule).toBe('fixed')
    expect(c.endDate).toBe(new Date(2026, 11, 31).getTime())
  })

  it('选择计数模式并开启不限次数', async () => {
    const w = mount(CheckinFormModal)
    await w.find('input.input').setValue('喝水记录')
    const segs = w.findAll('.seg-item')
    const countBtn = segs.find((b) => b.text().includes('计数模式'))
    await countBtn.trigger('click')
    expect(w.text()).toContain('不限次数')
    // 默认关闭不限 → 需要最低次数
    await w.find('.btn-primary').trigger('click')
    let c = store.state.checkins[0]
    expect(c.rule).toBe('count')
    expect(c.countUnlimited).toBe(false)
    expect(c.dailyTargetCount).toBe(1)
    // 打开不限次数再保存
    store._replace(defaultState())
    const w2 = mount(CheckinFormModal)
    await w2.find('input.input').setValue('自由记录')
    const segs2 = w2.findAll('.seg-item')
    await segs2.find((b) => b.text().includes('计数模式')).trigger('click')
    const switches = w2.findAll('.rule-sec .switch')
    await switches[0].trigger('click') // 不限次数
    await w2.find('.btn-primary').trigger('click')
    c = store.state.checkins[0]
    expect(c.rule).toBe('count')
    expect(c.countUnlimited).toBe(true)
    expect(c.dailyTargetCount).toBe(1)
  })

  it('空名称与目标次数校验', async () => {
    const w = mount(CheckinFormModal)
    await w.find('.btn-primary').trigger('click')
    expect(w.text()).toContain('请填写打卡名称')
    await w.find('input.input').setValue('x')
    const inputs = w.findAll('input.input')
    await inputs[2].setValue('0')
    await w.find('.btn-primary').trigger('click')
    expect(w.text()).toContain('每日目标次数至少为 1')
  })
})

describe('CheckinRecordModal', () => {
  it('时长型记录时长与日志备注', async () => {
    const c = store.addCheckin({ name: '阅读', fixedDurationMin: 30 })
    const w = mount(CheckinRecordModal, { props: { open: true, checkinId: c.id } })
    await nextTick()
    const input = document.body.querySelector('.modal-panel input[type="number"]')
    input.value = '45'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    const textarea = document.body.querySelector('.modal-panel textarea')
    textarea.value = '读完第三章'
    textarea.dispatchEvent(new Event('input'))
    await nextTick()
    const btns = [...document.body.querySelectorAll('.modal-panel button')]
    const submit = btns.find((b) => b.textContent.includes('记一次打卡'))
    submit.click()
    await nextTick()
    expect(store.state.checkinRecords).toHaveLength(1)
    expect(store.state.checkinRecords[0].durationMin).toBe(45)
    expect(store.state.checkinRecords[0].note).toBe('读完第三章')
    w.unmount()
  })

  it('次数型记录次数', async () => {
    const c = store.addCheckin({ name: '喝水', dailyTargetCount: 8 })
    const w = mount(CheckinRecordModal, { props: { open: true, checkinId: c.id } })
    await nextTick()
    const input = document.body.querySelector('.modal-panel input[type="number"]')
    input.value = '2'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    const btns = [...document.body.querySelectorAll('.modal-panel button')]
    btns.find((b) => b.textContent.includes('记一次打卡')).click()
    await nextTick()
    expect(store.state.checkinRecords[0].count).toBe(2)
    w.unmount()
  })
})

describe('CheckinsView', () => {
  function mountView() {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div/>' } }, { path: '/checkins/:id', component: { template: '<div/>' } }] })
    router.push('/')
    return mount(CheckinsView, { global: { plugins: [router] } })
  }

  it('次数型直接打卡触发激励动画与粒子', async () => {
    store.addCheckin({ name: '喝水', unit: '杯', dailyTargetCount: 3 })
    const w = mountView()
    await nextTick()
    const btn = w.find('.checkin-btn')
    await btn.trigger('click')
    await nextTick()
    expect(btn.classes()).toContain('pop-anim')
    expect(document.querySelectorAll('.particle').length).toBe(10)
    w.unmount()
  })

  it('次数型直接打卡并更新进度', async () => {
    store.addCheckin({ name: '喝水', unit: '杯', dailyTargetCount: 3 })
    const w = mountView()
    await nextTick()
    expect(w.text()).toContain('0/3 杯')
    await w.find('.checkin-btn').trigger('click')
    await nextTick()
    expect(store.state.checkinRecords).toHaveLength(1)
    expect(w.text()).toContain('1/3 杯')
    w.unmount()
  })

  it('达标后显示达标徽章', async () => {
    const c = store.addCheckin({ name: '喝水', unit: '杯', dailyTargetCount: 2 })
    const today = startOfDayTs(Date.now())
    store.addCheckinRecord(c.id, { count: 1, at: today + 3600000 })
    store.addCheckinRecord(c.id, { count: 1, at: today + 7200000 })
    const w = mountView()
    await nextTick()
    expect(w.text()).toContain('达标')
    w.unmount()
  })

  it('计数模式项目点击打卡打开数量弹层', async () => {
    store.addCheckin({ name: '背单词', unit: '个', dailyTargetCount: 20, rule: 'count' })
    const w = mountView()
    await nextTick()
    expect(w.text()).toContain('0/20 个')
    await w.find('.checkin-btn').trigger('click')
    await nextTick()
    expect(document.body.querySelector('.modal-panel')).toBeTruthy()
    w.unmount()
  })

  it('不限次数项目显示自由记录且打卡走弹层', async () => {
    store.addCheckin({ name: '灵感记录', unit: '条', dailyTargetCount: 1, rule: 'count', countUnlimited: true })
    const w = mountView()
    await nextTick()
    expect(w.text()).toContain('自由')
    await w.find('.checkin-btn').trigger('click')
    await nextTick()
    expect(document.body.querySelector('.modal-panel')).toBeTruthy()
    w.unmount()
  })

  it('时长型打开记录弹层', async () => {
    store.addCheckin({ name: '阅读', dailyTargetCount: 1, fixedDurationMin: 30 })
    const w = mountView()
    await w.find('.checkin-btn').trigger('click')
    await nextTick()
    expect(document.body.querySelector('.modal-panel')).toBeTruthy()
    w.unmount()
  })

  it('打卡专注按钮图标不为空（闹钟图形）', async () => {
    store.addCheckin({ name: '晨跑', dailyTargetCount: 1 })
    const w = mountView()
    await nextTick()
    const btn = w.find('.focus-mini')
    expect(btn.exists()).toBe(true)
    expect(btn.findAll('svg circle, svg polyline, svg line, svg path').length).toBeGreaterThan(0)
    w.unmount()
  })

  it('卡片专注按钮拉起针对该打卡项目的番茄专注', async () => {
    const c = store.addCheckin({ name: '晨跑', dailyTargetCount: 1 })
    const w = mountView()
    await nextTick()
    await w.find('.focus-mini').trigger('click')
    expect(store.focusState.visible).toBe(true)
    expect(store.focusState.targetType).toBe('checkin')
    expect(store.focusState.targetId).toBe(c.id)
    w.unmount()
  })

  it('带结束日期的项目显示倒计时/已结束徽章', async () => {
    const today = startOfDayTs(Date.now())
    store.addCheckin({ name: '限时挑战', dailyTargetCount: 1, endDate: today + 3 * DAY_MS })
    store.addCheckin({ name: '已过期项目', dailyTargetCount: 1, endDate: today - DAY_MS })
    store.addCheckin({ name: '永久项目', dailyTargetCount: 1 })
    const w = mountView()
    await nextTick()
    expect(w.text()).toContain('剩 3 天')
    expect(w.text()).toContain('已结束')
    const cdowns = w.findAll('.cdown')
    expect(cdowns).toHaveLength(2) // 永久项目不显示倒计时
    w.unmount()
  })

  it('已结束项目禁用打卡按钮', async () => {
    store.addCheckin({ name: '旧习惯', dailyTargetCount: 1, endDate: startOfDayTs(Date.now()) - DAY_MS })
    const w = mountView()
    await nextTick()
    expect(w.find('.checkin-btn').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('已结束')
    w.unmount()
  })
})

describe('CheckinDetailView 与图表', () => {
  async function mountDetail(id) {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/checkins/:id', component: { template: '<div/>' } }, { path: '/checkins', component: { template: '<div/>' } }] })
    await router.push(`/checkins/${id}`)
    await router.isReady()
    return mount(CheckinDetailView, { global: { plugins: [router] } })
  }

  it('统计与记录与数据一致', async () => {
    const c = store.addCheckin({ name: '跑步', unit: '公里', dailyTargetCount: 1, fixedDurationMin: 30 })
    const today = startOfDayTs(Date.now())
    // 昨天也达标
    store.addCheckinRecord(c.id, { durationMin: 30, at: today - DAY_MS + 3600000 })
    store.addCheckinRecord(c.id, { durationMin: 30, at: today + 3600000 })
    const w = await mountDetail(c.id)
    expect(w.text()).toContain('跑步')
    expect(w.text()).toContain('达标天数')
    expect(w.text()).toContain('当前连续')
    expect(w.text()).toContain('2') // 连续两天
    expect(w.text()).toContain('60') // 累计 60 分钟
    w.unmount()
  })

  it('三种图表可切换且渲染数据', async () => {
    const c = store.addCheckin({ name: '阅读', dailyTargetCount: 1, fixedDurationMin: 30 })
    const today = startOfDayTs(Date.now())
    store.addCheckinRecord(c.id, { durationMin: 35, at: today + 3 * 3600000 })
    const w = await mountDetail(c.id)
    await nextTick()
    // 默认折线图
    expect(w.findComponent(LineChart).exists()).toBe(true)
    const lineSvg = w.findComponent(LineChart).find('svg')
    expect(lineSvg.findAll('rect.bar').length).toBe(30)
    // 切热力
    const segs = w.findAll('.seg-item')
    await segs[1].trigger('click')
    await nextTick()
    expect(w.findComponent(Heatmap).exists()).toBe(true)
    expect(w.findComponent(Heatmap).findAll('rect').length).toBe(52 * 7)
    // 切甘特
    await segs[2].trigger('click')
    await nextTick()
    const gantt = w.findComponent(GanttChart)
    expect(gantt.exists()).toBe(true)
    expect(gantt.findAll('.gantt-bar, .gantt-dot').length).toBeGreaterThanOrEqual(1)
    w.unmount()
  })
})

describe('打卡图表数据修复与补打卡', () => {
  async function mountDetail(id) {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/checkins/:id', component: { template: '<div/>' } }, { path: '/checkins', component: { template: '<div/>' } }] })
    await router.push(`/checkins/${id}`)
    await router.isReady()
    return mount(CheckinDetailView, { global: { plugins: [router] } })
  }

  it('折线图序列覆盖到今天，当天有记录时柱子高度大于 0（回归）', async () => {
    const c = store.addCheckin({ name: '跑步', dailyTargetCount: 1 })
    const today = startOfDayTs(Date.now())
    store.addCheckinRecord(c.id, { count: 2, at: today + 9 * 3600000 })
    const w = await mountDetail(c.id)
    await nextTick()
    const bars = w.findComponent(LineChart).findAll('rect.bar')
    expect(bars).toHaveLength(30)
    // 序列最后一天 = 今天，且有记录 → 高度 > 0
    const last = bars[bars.length - 1]
    expect(Number(last.attributes('height'))).toBeGreaterThan(0)
    // 30 天前那一天没有记录 → 高度为 0
    expect(Number(bars[0].attributes('height'))).toBe(0)
    w.unmount()
  })

  it('补打卡：可选过去日期，记录计入统计与图表', async () => {
    const c = store.addCheckin({ name: '冥想', dailyTargetCount: 1, fixedDurationMin: 10 })
    const w = await mountDetail(c.id)
    await nextTick()
    const mkBtn = w.findAll('button').find((b) => b.text().includes('补打卡'))
    await mkBtn.trigger('click')
    await nextTick()
    const panels = [...document.querySelectorAll('.modal-panel')]
    const panel = panels[panels.length - 1]
    const y = new Date(Date.now() - 86400000)
    const ds = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`
    const dateInput = panel.querySelector('input[type="date"]')
    dateInput.value = ds
    dateInput.dispatchEvent(new Event('change'))
    await nextTick()
    const save = [...panel.querySelectorAll('button')].find((b) => b.textContent.includes('补上'))
    save.click()
    await nextTick()
    expect(store.state.checkinRecords).toHaveLength(1)
    const rec = store.state.checkinRecords[0]
    expect(new Date(rec.at).getDate()).toBe(y.getDate())
    expect(rec.durationMin).toBe(10)
    expect(rec.note).toBe('补打卡')
    // 累计时长随之更新
    expect(w.text()).toContain('10')
    w.unmount()
  })

  it('补打卡拒绝未来日期', async () => {
    const c = store.addCheckin({ name: '喝水', dailyTargetCount: 1 })
    const w = await mountDetail(c.id)
    await nextTick()
    const mkBtn = w.findAll('button').find((b) => b.text().includes('补打卡'))
    await mkBtn.trigger('click')
    await nextTick()
    const panels = [...document.querySelectorAll('.modal-panel')]
    const panel = panels[panels.length - 1]
    const t = new Date(Date.now() + 86400000)
    const ds = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    const dateInput = panel.querySelector('input[type="date"]')
    dateInput.value = ds
    dateInput.dispatchEvent(new Event('change'))
    await nextTick()
    const save = [...panel.querySelectorAll('button')].find((b) => b.textContent.includes('补上'))
    save.click()
    await nextTick()
    expect(store.state.checkinRecords).toHaveLength(0)
    w.unmount()
  })
})
