import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { todayMetCount, checkinTodayList, archivedCheckins } from '../src/selectors.js'
import { startOfDayTs, DAY_MS, addDaysTs } from '../src/utils/date.js'
import CheckinFormModal from '../src/components/checkin/CheckinFormModal.vue'
import CheckinRecordModal from '../src/components/checkin/CheckinRecordModal.vue'
import CheckinsView from '../src/views/CheckinsView.vue'
import CheckinDetailView from '../src/views/CheckinDetailView.vue'
import LineChart from '../src/components/checkin/charts/LineChart.vue'
import Heatmap from '../src/components/checkin/charts/Heatmap.vue'
import { confirmState, settleConfirm } from '../src/ui.js'

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

  it('卡片专注按钮：设置该打卡为专注目标并跳转专注主页面', async () => {
    const c = store.addCheckin({ name: '晨跑', dailyTargetCount: 1 })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div/>' } }, { path: '/focus', component: { template: '<div/>' } }],
    })
    await router.push('/')
    await router.isReady()
    const w = mount(CheckinsView, { global: { plugins: [router] } })
    await nextTick()
    await w.find('.focus-mini').trigger('click')
    await new Promise((r) => setTimeout(r, 10))
    expect(store.focusState.targetType).toBe('checkin')
    expect(store.focusState.targetId).toBe(c.id)
    expect(router.currentRoute.value.path).toBe('/focus')
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
    // 切热力：按半年分区展示
    const segs = w.findAll('.seg-item')
    await segs[1].trigger('click')
    await nextTick()
    const heat = w.findComponent(Heatmap)
    expect(heat.exists()).toBe(true)
    const now = new Date()
    const halfLabel = now.getMonth() < 6 ? '上半年' : '下半年'
    expect(heat.find('.hm-title').text()).toContain(`${now.getFullYear()} 年${halfLabel}`)
    // 只渲染该半年内的日期格子（不会铺满 52 周）
    const cellCount = heat.findAll('rect').length
    expect(cellCount).toBeGreaterThan(180)
    expect(cellCount).toBeLessThanOrEqual(186)
    // 只有两个图表模式：折线 / 热力（甘特图已移除）
    expect(segs.slice(0, 2).map((x) => x.text())).toEqual(['折线图', '热力图'])
    w.unmount()
  })
})

describe('热力图：半年分区与日期定位', () => {
  async function mountDetail(id) {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/checkins/:id', component: { template: '<div/>' } }, { path: '/checkins', component: { template: '<div/>' } }] })
    await router.push(`/checkins/${id}`)
    await router.isReady()
    return mount(CheckinDetailView, { global: { plugins: [router] } })
  }

  it('默认展示当前半年，可前后翻期', async () => {
    const lastYearStart = new Date(new Date().getFullYear() - 1, 0, 5).getTime()
    const c = store.addCheckin({ name: '阅读', dailyTargetCount: 1, startDate: lastYearStart })
    store.addCheckinRecord(c.id, { count: 1 })
    const w = await mountDetail(c.id)
    await nextTick()
    await w.findAll('.seg-item')[1].trigger('click') // 切到热力图
    await nextTick()
    const heat = w.findComponent(Heatmap)
    const now = new Date()
    const halfLabel = now.getMonth() < 6 ? '上半年' : '下半年'
    expect(heat.find('.hm-title').text()).toContain(`${now.getFullYear()} 年${halfLabel}`)
    // 有记录时上一期可点（开始日期/记录所在半年在更早）
    const prev = heat.find('.mini-btn')
    expect(prev.attributes('disabled')).toBeUndefined()
    await prev.trigger('click')
    await nextTick()
    const prevLabel = now.getMonth() < 6 ? '下半年' : '上半年'
    const prevYear = now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear()
    expect(w.findComponent(Heatmap).find('.hm-title').text()).toContain(`${prevYear} 年${prevLabel}`)
    w.unmount()
  })

  it('点击历史记录里的日期：切到热力图并定位到该日期所在半年并高亮', async () => {
    const c = store.addCheckin({ name: '跑步', rule: 'fixed', fixedDurationMin: 30 })
    // 造一条去年上半年的记录（定位到往期）
    const past = new Date(new Date().getFullYear() - 1, 2, 10, 12, 0, 0).getTime()
    store.addCheckinRecord(c.id, { count: 1, durationMin: 30, at: past })
    const w = await mountDetail(c.id)
    await nextTick()
    expect(w.findComponent(LineChart).exists()).toBe(true)
    const dateBtn = w.find('.rec-date')
    expect(dateBtn.text()).toContain('03-10')
    await dateBtn.trigger('click')
    await nextTick()
    const heat = w.findComponent(Heatmap)
    expect(heat.exists()).toBe(true)
    expect(heat.find('.hm-title').text()).toContain(`${new Date().getFullYear() - 1} 年上半年`)
    expect(heat.find('.hm-cell.focus').exists()).toBe(true)
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

describe('打卡归档', () => {
  async function mountList() {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div/>' } }, { path: '/checkins/:id', component: { template: '<div/>' } }, { path: '/focus', component: { template: '<div/>' } }] })
    await router.push('/')
    await router.isReady()
    return { w: mount(CheckinsView, { global: { plugins: [router] } }), router }
  }

  it('归档后从打卡列表与今日统计移除，进入归档箱并可恢复', async () => {
    const c = store.addCheckin({ name: '晨跑', dailyTargetCount: 1 })
    store.addCheckinRecord(c.id, { count: 1 })
    expect(todayMetCount(store.state)).toBe(1)
    expect(checkinTodayList(store.state).some((i) => i.checkin.id === c.id)).toBe(true)

    const { w } = await mountList()
    await nextTick()
    expect(w.text()).toContain('晨跑')
    // 卡片上的归档按钮
    const archBtn = w.find('.archive-mini')
    expect(archBtn.exists()).toBe(true)
    await archBtn.trigger('click')
    await nextTick()
    settleConfirm(true)
    await new Promise((r) => setTimeout(r, 10))

    expect(store.state.checkins[0].archived).toBe(true)
    expect(store.state.checkins[0].archivedAt).toBeTruthy()
    expect(todayMetCount(store.state)).toBe(0)
    expect(checkinTodayList(store.state).some((i) => i.checkin.id === c.id)).toBe(false)
    expect(archivedCheckins(store.state)).toHaveLength(1)

    // 归档箱里可恢复
    await nextTick()
    expect(w.find('.archived').text()).toContain('归档箱（1）')
    await w.find('.arch-head').trigger('click')
    await nextTick()
    const row = w.find('.arch-row')
    expect(row.text()).toContain('晨跑')
    await row.find('.btn-outline').trigger('click')
    await nextTick()
    expect(store.state.checkins[0].archived).toBe(false)
    expect(w.find('.archived').exists()).toBe(false)
    w.unmount()
  })

  it('打卡详情页可归档与恢复，并显示「已归档」标记', async () => {
    const c = store.addCheckin({ name: '阅读', dailyTargetCount: 1 })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/checkins/:id', component: { template: '<div/>' } }, { path: '/checkins', component: { template: '<div/>' } }, { path: '/focus', component: { template: '<div/>' } }] })
    await router.push(`/checkins/${c.id}`)
    await router.isReady()
    const w = mount(CheckinDetailView, { global: { plugins: [router] } })
    await nextTick()
    const archBtn = w.findAll('button').find((b) => b.text().includes('归档'))
    expect(archBtn).toBeTruthy()
    await archBtn.trigger('click')
    await nextTick()
    settleConfirm(true)
    await new Promise((r) => setTimeout(r, 10))
    expect(store.state.checkins[0].archived).toBe(true)
    await nextTick()
    expect(w.find('.arch-chip').text()).toBe('已归档')
    const restoreBtn = w.findAll('button').find((b) => b.text().includes('恢复'))
    await restoreBtn.trigger('click')
    await nextTick()
    expect(store.state.checkins[0].archived).toBe(false)
    w.unmount()
  })
})
