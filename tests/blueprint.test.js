import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { calendarItems } from '../src/selectors.js'
import { startOfDayTs, DAY_MS } from '../src/utils/date.js'
import HomeView from '../src/views/HomeView.vue'
import BlueprintsView from '../src/views/BlueprintsView.vue'
import BlueprintTimeline from '../src/components/blueprint/BlueprintTimeline.vue'
import BlueprintFormModal from '../src/components/blueprint/BlueprintFormModal.vue'

beforeEach(() => {
  store._replace(defaultState())
  const f = store.focusState
  f.visible = false
  f.phase = 'idle'
})

afterEach(() => {
  document.body.innerHTML = ''
})

function mountHome() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/todos', component: { template: '<div/>' } },
      { path: '/blueprints', component: { template: '<div/>' } },
      { path: '/projects/:id', component: { template: '<div/>' } },
    ],
  })
  router.push('/')
  const w = mount(HomeView, { global: { plugins: [router] } })
  return { w, router }
}

describe('未来蓝图 store actions', () => {
  it('新建蓝图默认构想中，可更新状态（搁置保留数据可恢复）', () => {
    const b = store.addBlueprint({ title: '十年后环游世界', dimension: 'life' })
    expect(b.status).toBe('idea')
    expect(store.state.blueprints).toHaveLength(1)
    store.updateBlueprint(b.id, { status: 'paused' })
    expect(store.state.blueprints[0].status).toBe('paused')
    store.updateBlueprint(b.id, { status: 'doing' })
    expect(store.state.blueprints[0].status).toBe('doing')
  })

  it('关联双向同步：syncRelated 与 todo/project.blueprintIds 一致', () => {
    const b1 = store.addBlueprint({ title: '蓝图A' })
    const b2 = store.addBlueprint({ title: '蓝图B' })
    const t = store.addTodo({ title: '任务X' })
    const p = store.addProject({ name: '项目Y' })
    store.syncRelated(b1.id, [{ type: 'todo', id: t.id }, { type: 'project', id: p.id }])
    expect(t.blueprintIds).toEqual([b1.id])
    expect(p.blueprintIds).toEqual([b1.id])
    // 多蓝图可同时关联同一任务
    store.syncRelated(b2.id, [{ type: 'todo', id: t.id }])
    expect(t.blueprintIds).toEqual([b1.id, b2.id])
    // 解除关联后反向清空
    store.syncRelated(b1.id, [{ type: 'project', id: p.id }])
    expect(t.blueprintIds).toEqual([b2.id])
    expect(p.blueprintIds).toEqual([b1.id])
    // 删除蓝图清理反向引用
    store.deleteBlueprint(b1.id)
    expect(p.blueprintIds).toEqual([])
  })

  it('拆解为新项目 / 待办任务并自动绑定', () => {
    const b = store.addBlueprint({ title: '出一本书', desc: '想写本小说' })
    const p = store.breakdownProject(b.id)
    expect(p.name).toBe('出一本书')
    const bp = store.state.blueprints.find((x) => x.id === b.id)
    expect(bp.related).toContainEqual({ type: 'project', id: p.id })
    expect(p.blueprintIds).toContain(b.id)
    const t = store.breakdownTodo(b.id)
    expect(t.title).toBe('出一本书')
    expect(t.blueprintIds).toContain(b.id)
  })

  it('自定义维度：新增/重名拒绝/删除后蓝图回到未分组', () => {
    const d = store.addBlueprintDimension('家庭')
    expect(d.name).toBe('家庭')
    expect(store.addBlueprintDimension('家庭')).toBeNull()
    const b = store.addBlueprint({ title: '平衡家庭', dimension: d.id })
    expect(b.dimension).toBe(d.id)
    store.removeBlueprintDimension(d.id)
    expect(store.state.blueprints.find((x) => x.id === b.id).dimension).toBe('')
    expect(store.state.settings.blueprintDims).toHaveLength(0)
  })

  it('时间段字段：起点~终点；旧单点数据自动按终点兼容', () => {
    const today = startOfDayTs(Date.now())
    const b = store.addBlueprint({ title: '旅居计划', goalStartTs: today + 20 * DAY_MS, goalEndTs: today + 80 * DAY_MS })
    expect(b.goalStartTs).toBe(today + 20 * DAY_MS)
    expect(b.goalEndTs).toBe(today + 80 * DAY_MS)
    // 旧版单点字段在新建时归并为终点
    const legacy = store.addBlueprint({ title: '旧蓝图', goalDateTs: today + 30 * DAY_MS })
    expect(legacy.goalDateTs).toBeNull()
    expect(legacy.goalEndTs).toBe(today + 30 * DAY_MS)
  })

  it('日历默认不含蓝图，开启后仅展示未搁置/未完成且带日期的条目', () => {
    const today = startOfDayTs(Date.now())
    store.addBlueprint({ title: '规划中的事', goalDateTs: today + 30 * DAY_MS, status: 'doing' })
    store.addBlueprint({ title: '已搁置', goalDateTs: today + 40 * DAY_MS, status: 'paused' })
    store.addBlueprint({ title: '无日期', status: 'idea' })
    let items = calendarItems(store.state, today, today + 365 * DAY_MS)
    expect(items.some((it) => it.ref === 'blueprint')).toBe(false)
    store.setSetting('showBlueprintsOnCalendar', true)
    items = calendarItems(store.state, today, today + 365 * DAY_MS)
    const bps = items.filter((it) => it.ref === 'blueprint')
    expect(bps).toHaveLength(1)
    expect(bps[0].blueprint.title).toBe('规划中的事')
  })
})

describe('未来蓝图页面', () => {
  it('时间段期望：卡片展示起止区间', async () => {
    const today = startOfDayTs(Date.now())
    store.addBlueprint({ title: '学第二外语', goalStartTs: today + 15 * DAY_MS, goalEndTs: today + 200 * DAY_MS, status: 'doing' })
    const w = mount(BlueprintsView)
    await nextTick()
    expect(w.text()).toMatch(/\d{4}-\d{2}-\d{2} ~ \d{4}-\d{2}-\d{2}/)
    expect(w.text()).toContain('学第二外语')
    w.unmount()
  })

  it('统计与筛选：维度计数、卡片渲染', async () => {
    store.addBlueprint({ title: '读博', dimension: 'study', status: 'idea' })
    store.addBlueprint({ title: '副业', dimension: 'finance', status: 'doing' })
    const w = mount(BlueprintsView)
    await nextTick()
    expect(w.text()).toContain('读博')
    expect(w.text()).toContain('副业')
    expect(w.text()).toContain('学习成长 1')
    expect(w.text()).toContain('财务 1')
    w.unmount()
  })
})

describe('蓝图编辑表单', () => {
  it('二次打开编辑已规划蓝图时表单正确回填', async () => {
    const today = startOfDayTs(Date.now())
    const b = store.addBlueprint({ title: '二次编辑蓝图', desc: '旧描述', goalStartTs: today + 5 * DAY_MS, goalEndTs: today + 60 * DAY_MS, status: 'doing', dimension: 'study' })
    const w = mount(BlueprintFormModal, { props: { open: true, blueprint: b } })
    await nextTick()
    const titleInput = () => [...document.querySelectorAll('.modal-panel input')].find((i) => i.type !== 'date' && i.type !== 'checkbox')
    expect(titleInput().value).toBe('二次编辑蓝图')
    // 关闭后再打开同一蓝图（二次编辑场景）
    await w.setProps({ open: false })
    await nextTick()
    await w.setProps({ open: true })
    await nextTick()
    expect(titleInput().value).toBe('二次编辑蓝图')
    expect(document.querySelector('.modal-panel').textContent).toContain('study' ? '学习成长' : '')
    // 切到新建蓝图时表单清空
    await w.setProps({ blueprint: null })
    await nextTick()
    expect(titleInput().value).toBe('')
    w.unmount()
  })
})

describe('蓝图等级与尺寸渲染', () => {
  it('新建默认小蓝图，可改为中/大', () => {
    const b = store.addBlueprint({ title: '默认等级' })
    expect(b.level).toBe('small')
    store.updateBlueprint(b.id, { level: 'large' })
    expect(store.state.blueprints[0].level).toBe('large')
  })

  it('进度条按等级渲染不同尺寸，大蓝图排在上方', async () => {
    const now = Date.now()
    store.addBlueprint({ title: '小事一桩', level: 'small', status: 'doing', goalEndTs: now + 3600000 })
    store.addBlueprint({ title: '中等目标', level: 'medium', status: 'doing', goalEndTs: now + 3600000 })
    store.addBlueprint({ title: '人生大事', level: 'large', status: 'doing', goalEndTs: now + 3600000 })
    const w = mount(BlueprintTimeline, { props: { items: store.state.blueprints } })
    await nextTick()
    const bars = w.findAll('.bar')
    expect(bars).toHaveLength(3)
    // 排序：大 → 中 → 小
    expect(bars[0].text()).toContain('人生大事')
    expect(bars[1].text()).toContain('中等目标')
    expect(bars[2].text()).toContain('小事一桩')
    // 尺寸：大 > 中 > 小
    expect(bars[0].attributes('style')).toContain('height: 46px')
    expect(bars[1].attributes('style')).toContain('height: 34px')
    expect(bars[2].attributes('style')).toContain('height: 24px')
    w.unmount()
  })
})

describe('四个月视窗时间轴', () => {
  it('无期望达成时间的条目进入构想池，带截止期的条目渲染为进度条', async () => {
    const now = Date.now()
    store.addBlueprint({ title: '模糊构想', goalText: '退休前', status: 'idea' })
    const timed = store.addBlueprint({ title: '有期限目标', status: 'doing', goalEndTs: now + 3600000 })
    const w = mount(BlueprintTimeline, { props: { items: store.state.blueprints } })
    await nextTick()
    expect(w.text()).toContain('构想池')
    expect(w.text()).toContain('模糊构想')
    expect(w.text()).toContain('有期限目标')
    expect(w.findAll('.bar')).toHaveLength(1)
    w.unmount()
  })

  it('切换到下一个季度视窗', async () => {
    const now = Date.now()
    store.addBlueprint({ title: '远期目标', status: 'idea', goalEndTs: now + 14 * 30 * DAY_MS })
    const w = mount(BlueprintTimeline, { props: { items: store.state.blueprints } })
    await nextTick()
    const before = w.findAll('.bar').length
    // 点击“下一个季度”
    const btns = w.findAll('.vp-btn')
    const labelBefore = w.find('.vp-title strong').text()
    await btns[1].trigger('click')
    await nextTick()
    expect(w.find('.vp-title strong').text()).not.toBe(labelBefore)
    expect(before).toBeGreaterThanOrEqual(0)
    w.unmount()
  })
})

describe('首页未来蓝图板块', () => {
  it('显示进行中与临期的蓝图，隐藏搁置/已完成', async () => {
    const now = Date.now()
    store.addBlueprint({ title: '进行中的目标', status: 'doing', goalDateTs: now + 20 * DAY_MS })
    store.addBlueprint({ title: '临期构想', status: 'idea', goalDateTs: now + 30 * DAY_MS })
    store.addBlueprint({ title: '已搁置的', status: 'paused', goalDateTs: now + 30 * DAY_MS })
    store.addBlueprint({ title: '已完成的', status: 'done', goalDateTs: now + 30 * DAY_MS })
    store.addBlueprint({ title: '遥远的构想', status: 'idea', goalDateTs: now + 400 * DAY_MS })
    const { w } = mountHome()
    await nextTick()
    expect(w.text()).toContain('未来蓝图')
    expect(w.text()).toContain('进行中的目标')
    expect(w.text()).toContain('临期构想')
    expect(w.text()).not.toContain('已搁置的')
    expect(w.text()).not.toContain('已完成的')
    expect(w.text()).not.toContain('遥远的构想')
    w.unmount()
  })

  it('点击蓝图行进详情抽屉', async () => {
    const b = store.addBlueprint({ title: '点开我', status: 'doing', goalDateTs: Date.now() + 10 * DAY_MS, desc: '愿景描述' })
    const { w } = mountHome()
    await nextTick()
    const row = w.findAll('.bp-home-row').find((r) => r.text().includes('点开我'))
    row.trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain('愿景描述')
    expect(document.body.textContent).toContain('拆解为新项目')
    w.unmount()
  })
})
