import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { todoOverdue, todoActiveOnDay, calendarItems, archivedTodos, selectDueTodos } from '../src/selectors.js'
import { startOfWeekTs, parseDateStr, parseDateTimeStr, startOfDayTs, addDaysTs, DAY_MS, fmtDate } from '../src/utils/date.js'
import TodoFormModal from '../src/components/todo/TodoFormModal.vue'
import TaskItem from '../src/components/todo/TaskItem.vue'
import TaskDrawer from '../src/components/todo/TaskDrawer.vue'
import TodosView from '../src/views/TodosView.vue'
import ProjectDetailView from '../src/views/ProjectDetailView.vue'
import TagPicker from '../src/components/form/TagPicker.vue'
import ConfirmDialog from '../src/components/ui/ConfirmDialog.vue'
import { settleConfirm, confirmState } from '../src/ui.js'

function mkTodo(over = {}) {
  return {
    id: over.id || 't' + Math.random().toString(36).slice(2, 8),
    title: over.title || '任务',
    note: over.note || '',
    timeType: over.timeType || 'none',
    startAt: over.startAt ?? null,
    endAt: over.endAt ?? null,
    completed: over.completed ?? false,
    completedAt: over.completedAt ?? null,
    tagIds: over.tagIds || [],
    parentId: over.parentId ?? null,
    order: 0,
    createdAt: 0,
  }
}

beforeEach(() => {
  store._replace(defaultState())
})

afterEach(() => {
  confirmState.visible = false
  confirmState.resolve = null
  document.body.innerHTML = ''
})

describe('TodoFormModal 新建/编辑', () => {
  it('空标题不能保存并提示', async () => {
    const w = mount(TodoFormModal)
    await w.find('.btn-primary').trigger('click')
    expect(w.text()).toContain('请填写任务标题')
    expect(store.state.todos).toHaveLength(0)
  })

  it('新建无时间任务', async () => {
    const w = mount(TodoFormModal)
    await w.find('input.input').setValue('买牛奶')
    await w.find('.btn-primary').trigger('click')
    expect(store.state.todos).toHaveLength(1)
    const t = store.state.todos[0]
    expect(t.title).toBe('买牛奶')
    expect(t.timeType).toBe('none')
    expect(t.parentId).toBeNull()
  })

  it('新建精确到秒的时间点任务并设置每周循环', async () => {
    const w = mount(TodoFormModal)
    await w.find('input.input').setValue('例会')
    const segBtns = w.findAll('.seg-item')
    await segBtns[2].trigger('click') // 时间点 datetime
    const dateInputs = w.findAll('input[type="date"]')
    const timeInputs = w.findAll('input[type="time"]')
    dateInputs[0].element.value = '2026-09-02'
    await dateInputs[0].trigger('change')
    timeInputs[0].element.value = '09:00:00'
    await timeInputs[0].trigger('change')
    // 选中“每周”循环
    const allSegs = w.findAll('.seg-item')
    const weeklyBtn = allSegs.find((b) => b.text() === '每周')
    await weeklyBtn.trigger('click')
    await w.find('.btn-primary').trigger('click')
    const t = store.state.todos[0]
    expect(t.recurrence).toEqual({ freq: 'weekly', step: 1 })
  })

  it('循环步长可自定义为每 N 个周期', async () => {
    const w = mount(TodoFormModal)
    await w.find('input.input').setValue('健身')
    const segBtns = w.findAll('.seg-item')
    await segBtns[2].trigger('click')
    const dateInputs = w.findAll('input[type="date"]')
    dateInputs[0].element.value = '2026-09-02'
    await dateInputs[0].trigger('change')
    const allSegs = w.findAll('.seg-item')
    const dailyBtn = allSegs.find((b) => b.text() === '每日')
    await dailyBtn.trigger('click')
    const stepInput = w.findAll('input.input').find((i) => i.attributes('type') === 'number')
    await stepInput.setValue('3')
    await w.find('.btn-primary').trigger('click')
    expect(store.state.todos[0].recurrence).toEqual({ freq: 'daily', step: 3 })
  })

  it('时间点任务选择“不重复”不写入循环', async () => {
    const w = mount(TodoFormModal)
    await w.find('input.input').setValue('一次性')
    const segBtns = w.findAll('.seg-item')
    await segBtns[2].trigger('click')
    await w.find('.btn-primary').trigger('click')
    expect(store.state.todos[0].recurrence).toBeNull()
  })

  it('新建精确到秒的时间点任务', async () => {
    const w = mount(TodoFormModal)
    await w.find('input.input').setValue('开会')
    const segBtns = w.findAll('.seg-item')
    await segBtns[2].trigger('click') // 时间点 datetime
    const dateInputs = w.findAll('input[type="date"]')
    const timeInputs = w.findAll('input[type="time"]')
    expect(dateInputs.length).toBe(1)
    expect(timeInputs.length).toBe(1)
    const d = dateInputs[0]
    d.element.value = '2026-09-02'
    await d.trigger('change')
    const tm = timeInputs[0]
    tm.element.value = '14:30:25'
    await tm.trigger('change')
    await w.find('.btn-primary').trigger('click')
    const t = store.state.todos[0]
    expect(t.timeType).toBe('datetime')
    expect(t.startAt).toBe(parseDateTimeStr('2026-09-02 14:30:25'))
    expect(t.endAt).toBeNull()
  })

  it('新建时间段任务，结束必须晚于开始', async () => {
    const w = mount(TodoFormModal)
    await w.find('input.input').setValue('写方案')
    const segBtns = w.findAll('.seg-item')
    await segBtns[3].trigger('click') // 时间段 range
    const dates = w.findAll('input[type="date"]')
    const times = w.findAll('input[type="time"]')
    expect(dates.length).toBe(2)
    // 先设结束早于开始 → 校验失败
    const setVal = async (el, val) => {
      el.element.value = val
      await el.trigger('change')
    }
    await setVal(dates[0], '2026-09-02')
    await setVal(times[0], '15:00:00')
    await setVal(dates[1], '2026-09-02')
    await setVal(times[1], '10:00:00')
    await w.find('.btn-primary').trigger('click')
    expect(w.text()).toContain('结束晚于开始')
    expect(store.state.todos).toHaveLength(0)
    // 修正结束时间
    await setVal(times[1], '16:30:00')
    await w.find('.btn-primary').trigger('click')
    const t = store.state.todos[0]
    expect(t.timeType).toBe('range')
    expect(t.startAt).toBe(parseDateTimeStr('2026-09-02 15:00:00'))
    expect(t.endAt).toBe(parseDateTimeStr('2026-09-02 16:30:00'))
  })

  it('可作为子任务创建（父任务下拉）', async () => {
    const parent = store.addTodo({ title: '根任务' })
    const w = mount(TodoFormModal, { props: { defaultParentId: parent.id } })
    await w.find('input.input').setValue('子任务一')
    const select = w.find('select')
    expect(select.element.value).toBe('t:' + parent.id)
    await w.find('.btn-primary').trigger('click')
    expect(store.state.todos[1].parentId).toBe(parent.id)
  })

  it('归属下拉可选“项目”作为项目任务', async () => {
    const p = store.addProject({ name: '某项目' })
    const w = mount(TodoFormModal)
    await w.find('input.input').setValue('项目里的任务')
    const select = w.find('select')
    await select.setValue('p:' + p.id)
    await w.find('.btn-primary').trigger('click')
    const t = store.state.todos[0]
    expect(t.projectId).toBe(p.id)
    expect(t.parentId).toBeNull()
  })

  it('编辑模式回显并保存修改', async () => {
    const t = store.addTodo({ title: '旧标题', timeType: 'date', startAt: parseDateStr('2026-09-02') })
    const w = mount(TodoFormModal, { props: { todo: { ...t } } })
    const titleInput = w.find('input.input')
    expect(titleInput.element.value).toBe('旧标题')
    await titleInput.setValue('新标题')
    await w.find('.btn-primary').trigger('click')
    expect(store.state.todos[0].title).toBe('新标题')
    expect(store.state.todos[0].timeType).toBe('date')
    expect(store.state.todos[0].startAt).toBe(parseDateStr('2026-09-02'))
  })
})

describe('TagPicker', () => {
  it('点击标签发射选择，再点取消', async () => {
    const tg = store.addTag({ name: '学习', color: '#0EA5E9' })
    const w = mount(TagPicker, { props: { modelValue: [] } })
    const chip = w.findAll('.pool-chip').find((c) => c.text().includes('学习'))
    await chip.trigger('click')
    expect(w.emitted('update:modelValue')[0]).toEqual([[tg.id]])
    await w.setProps({ modelValue: [tg.id] })
    await chip.trigger('click')
    expect(w.emitted('update:modelValue')[1]).toEqual([[]])
  })

  it('新建标签写入 store', async () => {
    const w = mount(TagPicker, { props: { modelValue: [] } })
    await w.find('.pool-chip.new').trigger('click')
    await w.find('input.input').setValue('工作')
    await w.find('.btn-sm.btn-primary').trigger('click')
    expect(store.state.tags.some((t) => t.name === '工作')).toBe(true)
  })
})

describe('TaskItem 树形', () => {
  it('渲染主任务与展开的子任务，勾选联动 store', async () => {
    const root = store.addTodo({ title: '主任务' })
    store.addTodo({ title: '子任务', parentId: root.id })
    const w = mount(TaskItem, { props: { todo: store.state.todos.find((t) => t.id === root.id) } })
    expect(w.text()).toContain('主任务')
    expect(w.text()).toContain('子任务')
    expect(w.text()).toContain('0/1')
    await w.findAll('.check')[1].trigger('click')
    expect(store.state.todos.find((t) => t.title === '子任务').completed).toBe(true)
  })

  it('子任务全部完成后主任务出现一键完成', async () => {
    const root = store.addTodo({ title: '主' })
    store.addTodo({ title: '子1', parentId: root.id })
    store.addTodo({ title: '子2', parentId: root.id })
    const w = mount(TaskItem, { props: { todo: store.state.todos.find((t) => t.id === root.id) } })
    expect(w.find('.onekey').exists()).toBe(false)
    const checks = w.findAll('.check')
    await checks[1].trigger('click')
    await checks[2].trigger('click')
    await nextTick()
    expect(w.find('.onekey').exists()).toBe(true)
    await w.find('.onekey').trigger('click')
    expect(store.state.todos.find((t) => t.id === root.id).completed).toBe(true)
  })

  it('优先级颜色标记：行内竖条颜色类正确', () => {
    const t = store.addTodo({ title: '高优先级任务', priority: 'high' })
    const w = mount(TaskItem, { props: { todo: store.state.todos.find((x) => x.id === t.id) } })
    const bar = w.find('.pri-bar')
    expect(bar.exists()).toBe(true)
    expect(bar.classes()).toContain('pri-high')
    w.unmount()
  })

  it('TodoFormModal 选择高优先级保存', async () => {
    const w = mount(TodoFormModal)
    await w.find('input.input').setValue('紧急任务')
    const segs = w.findAll('.seg-item')
    const highBtn = segs.find((b) => b.text() === '高')
    await highBtn.trigger('click')
    await w.find('.btn-primary').trigger('click')
    expect(store.state.todos[0].priority).toBe('high')
  })

  it('逾期任务显示已逾期标识', () => {
    const overdue = store.addTodo({ title: '过期事', timeType: 'datetime', startAt: Date.now() - 3600000 })
    const w = mount(TaskItem, { props: { todo: store.state.todos.find((t) => t.id === overdue.id) } })
    expect(w.text()).toContain('已逾期')
  })
})

describe('TaskDrawer 详情', () => {
  it('展示任务信息、子任务与专注记录', () => {
    const root = store.addTodo({ title: '详情任务', timeType: 'datetime', startAt: parseDateTimeStr('2026-09-02 09:00:00'), note: '备注内容' })
    const sub = store.addTodo({ title: '子X', parentId: root.id })
    store.toggleTodo(sub.id, true)
    store.addSession({ mode: 'pomodoro', targetType: 'todo', targetId: root.id, startAt: 100, endAt: 200, durationMin: 25, plannedMinutes: 25 })
    mount(TaskDrawer, { props: { open: true, todoId: root.id } })
    const panel = document.body.querySelector('.drawer-panel')
    expect(panel.textContent).toContain('详情任务')
    expect(panel.textContent).toContain('备注内容')
    expect(panel.textContent).toContain('子X')
    expect(panel.textContent).toContain('1/1')
    expect(panel.textContent).toContain('25 分钟')
  })

  it('逾期任务已移除推迟入口：抽屉里没有推迟按钮', async () => {
    const t = store.addTodo({ title: '过期汇报', timeType: 'datetime', startAt: Date.now() - 3600000 })
    expect(todoOverdue(t, Date.now())).toBe(true)
    const w = mount(TaskDrawer, { props: { open: true, todoId: t.id } })
    await nextTick()
    const panel = document.querySelector('.drawer-panel')
    expect(panel.textContent).toContain('已逾期')
    const delayBtn = [...panel.querySelectorAll('button')].find((b) => b.textContent.includes('推迟'))
    expect(delayBtn).toBeUndefined()
    w.unmount()
  })

  it('已在推迟期内的任务可调整/取消推迟（推迟期内不算逾期，到期恢复逾期）', async () => {
    const t = store.addTodo({ title: '延期中的任务', timeType: 'datetime', startAt: Date.now() - 3600000 })
    const future = Date.now() + 3600000
    store.updateTodo(t.id, { snoozeUntil: future })
    let t2 = store.state.todos.find((x) => x.id === t.id)
    expect(t2.snoozeUntil).toBe(future)
    expect(todoOverdue(t2, Date.now())).toBe(false)
    expect(todoOverdue(t2, future + 1000)).toBe(true)

    // 推迟期内抽屉提供「调整推迟」入口
    const w = mount(TaskDrawer, { props: { open: true, todoId: t.id } })
    await nextTick()
    const panel = document.querySelector('.drawer-panel')
    const delayBtn = [...panel.querySelectorAll('button')].find((b) => b.textContent.includes('调整推迟'))
    expect(delayBtn).toBeTruthy()
    delayBtn.click()
    await nextTick()
    const modal = document.body.querySelector('.modal-panel')
    expect(modal.textContent).toContain('取消推迟')
    w.unmount()

    store.updateTodo(t.id, { snoozeUntil: null })
    t2 = store.state.todos.find((x) => x.id === t.id)
    expect(t2.snoozeUntil).toBeNull()
    expect(todoOverdue(t2, Date.now())).toBe(true)
  })

  it('抽屉点“创建副本”生成同内容的新未完成任务', async () => {
    const t = store.addTodo({ title: '要复制的任务', priority: 'high', tagIds: ['x'] })
    const w = mount(TaskDrawer, { props: { open: true, todoId: t.id } })
    await nextTick()
    const dupBtn = [...document.body.querySelectorAll('.drawer-panel button')].find((b) => b.textContent.includes('创建副本'))
    dupBtn.click()
    await nextTick()
    expect(store.state.todos).toHaveLength(2)
    const copy = store.state.todos.find((x) => x.id !== t.id)
    expect(copy.title).toBe('要复制的任务')
    expect(copy.priority).toBe('high')
    expect(copy.completed).toBe(false)
    w.unmount()
  })

  it('删除任务级联并关闭抽屉', async () => {
    const root = store.addTodo({ title: '待删' })
    store.addTodo({ title: '子', parentId: root.id })
    mount(ConfirmDialog)
    const w = mount(TaskDrawer, { props: { open: true, todoId: root.id } })
    await nextTick()
    const delBtn = document.body.querySelector('.drawer-panel .btn-danger')
    expect(delBtn).toBeTruthy()
    delBtn.click()
    await nextTick()
    expect(document.body.textContent).toContain('将同时删除 1 个子任务')
    settleConfirm(true)
    await new Promise((r) => setTimeout(r, 10))
    await nextTick()
    expect(store.state.todos).toHaveLength(0)
    expect(w.emitted('close')).toBeTruthy()
  })
})

describe('TodosView 列表与筛选', () => {
  const dayStart = () => startOfDayTs(Date.now())

  function mountView() {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div/>' } }, { path: '/focus', component: { template: '<div/>' } }, { path: '/projects', component: { template: '<div/>' } }] })
    router.push('/')
    return { w: mount(TodosView, { global: { plugins: [router] } }), router }
  }

  it('已完成任务自动进入归档箱，可恢复', async () => {
    const d = dayStart()
    store.addTodo({ title: '活动项', timeType: 'date', startAt: d })
    const done = store.addTodo({ title: '完成项', timeType: 'date', startAt: d })
    store.toggleTodo(done.id, true)
    const { w } = mountView()
    await nextTick()
    // 主列表只留未完成任务
    expect(w.findAll('.task-row')).toHaveLength(1)
    expect(w.text()).toContain('活动项')
    expect(w.text()).not.toContain('完成项')
    // 归档箱
    const archBtn = w.findAll('button').find((b) => b.text().includes('归档箱'))
    expect(archBtn.text()).toContain('1')
    await archBtn.trigger('click')
    await nextTick()
    expect(w.text()).toContain('完成项')
    expect(w.text()).toContain('已完成')
    // 恢复
    const restoreBtn = w.findAll('button').find((b) => b.text().includes('恢复'))
    await restoreBtn.trigger('click')
    await nextTick()
    expect(store.state.todos.find((x) => x.id === done.id).completed).toBe(false)
    w.unmount()
  })

  it('取消任务：确认后移入归档箱，可恢复', async () => {
    store.addTodo({ title: '要取消的任务', timeType: 'date', startAt: startOfDayTs(Date.now()) })
    const { w } = mountView()
    await nextTick()
    await w.find('.cancel-btn').trigger('click')
    await nextTick()
    // 确认弹窗（ConfirmDialog 是全局组件，这里直接结算确认）
    expect(confirmState.visible).toBe(true)
    settleConfirm(true)
    await nextTick()
    await nextTick()
    const t = store.state.todos[0]
    expect(t.canceled).toBe(true)
    expect(t.canceledAt).not.toBeNull()
    expect(w.text()).not.toContain('要取消的任务')
    // 归档箱中出现且可恢复
    const archBtn = w.findAll('button').find((b) => b.text().includes('归档箱'))
    await archBtn.trigger('click')
    await nextTick()
    expect(w.text()).toContain('已取消')
    expect(w.text()).toContain('要取消的任务')
    const restoreBtn = w.findAll('button').find((b) => b.text().includes('恢复'))
    await restoreBtn.trigger('click')
    await nextTick()
    expect(store.state.todos[0].canceled).toBe(false)
    w.unmount()
  })

  it('排序选项：自定义/按时间/按重要程度', async () => {
    const d = dayStart()
    // A order 0、无优先级、后天；B order 1、高优先级、今天；C order 2、中优先级、无时间
    store.addTodo({ title: 'A晚而无优先级', timeType: 'date', startAt: d + 2 * DAY_MS })
    store.addTodo({ title: 'B早而高优先级', timeType: 'date', startAt: d, priority: 'high' })
    store.addTodo({ title: 'C中优先级无时间', priority: 'medium' })
    const { w } = mountView()
    // 默认「今天」分组，这里切到「全部」以便比较全部任务
    await w.findAll('.seg-item')[0].trigger('click')
    await nextTick()
    const sel = w.find('select')
    const titles = () => w.findAll('.task-row').map((r) => r.text())
    // 默认自定义：按创建顺序
    expect(titles()[0]).toContain('A晚而无优先级')
    expect(titles()[2]).toContain('C中优先级无时间')
    // 按时间：B 最早在前，无时间的 C 沉底
    sel.element.value = 'time'
    await sel.trigger('change')
    expect(titles()[0]).toContain('B早而高优先级')
    expect(titles()[1]).toContain('A晚而无优先级')
    expect(titles()[2]).toContain('C中优先级无时间')
    // 非自定义模式禁用拖拽
    expect(w.findAll('.task-row')[0].element.getAttribute('draggable')).toBe('false')
    // 按重要程度：高 > 中 > 无
    sel.element.value = 'priority'
    await sel.trigger('change')
    expect(titles()[0]).toContain('B早而高优先级')
    expect(titles()[1]).toContain('C中优先级无时间')
    expect(titles()[2]).toContain('A晚而无优先级')
    // 回到自定义顺序恢复拖拽
    sel.element.value = 'custom'
    await sel.trigger('change')
    expect(w.findAll('.task-row')[0].element.getAttribute('draggable')).toBe('true')
    w.unmount()
  })

  it('展示树形任务与空状态', () => {
    const { w } = mountView()
    expect(w.text()).toContain('还没有任务')
    w.unmount()
  })

  it('进入默认定位「今天」，分组筛选（全部/今天/逾期/本周/本月）生效', async () => {
    const today = dayStart()
    const past = today - DAY_MS
    store.addTodo({ title: '今天任务', timeType: 'date', startAt: today })
    store.addTodo({ title: '昨天任务', timeType: 'date', startAt: past })
    const { w } = mountView()
    await nextTick()
    // 默认今天：只显示今天任务
    expect(w.findAll('.task-row')).toHaveLength(1)
    expect(w.text()).toContain('今天任务')
    expect(w.text()).not.toContain('昨天任务')
    const segs = w.findAll('.seg-item')
    // 全部
    await segs[0].trigger('click')
    await nextTick()
    expect(w.findAll('.task-row')).toHaveLength(2)
    // 逾期
    await segs[2].trigger('click')
    await nextTick()
    expect(w.text()).toContain('昨天任务')
    expect(w.text()).not.toContain('今天任务')

    // 本周 / 本月：按日期动态计算应有条数（避免周一/月初等边界导致用例失效）
    const inWeek = (ts) => {
      const ws = startOfWeekTs(today)
      return ts >= ws && ts < ws + 7 * DAY_MS
    }
    const inMonth = (ts) => {
      const d = new Date(today)
      return ts >= new Date(d.getFullYear(), d.getMonth(), 1).getTime() &&
        ts < new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
    }
    const weekCount = [today, past].filter(inWeek).length
    const monthCount = [today, past].filter(inMonth).length

    await segs[3].trigger('click')
    await nextTick()
    expect(w.findAll('.task-row')).toHaveLength(weekCount)
    await segs[4].trigger('click')
    await nextTick()
    expect(w.findAll('.task-row')).toHaveLength(monthCount)
    w.unmount()
  })

  it('拖拽任务行改变手动排序', async () => {
    store.addTodo({ title: '任务A', order: 0 })
    store.addTodo({ title: '任务B', order: 1 })
    const { w } = mountView()
    // 无时间任务在「今天」分组不显示，切到「全部」
    await w.findAll('.seg-item')[0].trigger('click')
    await nextTick()
    const rows = w.findAll('.task-row')
    expect(w.findAll('.title')[0].text()).toBe('任务A')
    const dt = { _v: '', setData(_t, v) { this._v = v }, getData() { return this._v }, effectAllowed: '', dropEffect: '' }
    await rows[1].trigger('dragstart', { dataTransfer: dt })
    await rows[0].trigger('drop', { dataTransfer: dt })
    await nextTick()
    expect(w.findAll('.title')[0].text()).toBe('任务B')
    w.unmount()
  })

  it('我的任务与项目任务合并为统一列表', async () => {
    const p = store.addProject({ name: '学习项目X' })
    store.addSubTask({ projectId: p.id, name: '项目里的任务', dueAt: Date.now() + 3600000 })
    store.addTodo({ title: '普通任务', timeType: 'date', startAt: dayStart() })
    const { w } = mountView()
    await nextTick()
    // 同一个列表里同时出现两类任务，且项目任务带项目名
    expect(w.text()).toContain('普通任务')
    expect(w.text()).toContain('项目里的任务')
    expect(w.find('.proj-mini').text()).toBe('学习项目X')
    // 不再有「我的任务 / 项目任务」切换
    const labels = w.findAll('.seg-item').map((b) => b.text())
    expect(labels).toEqual(['全部', '今天', '逾期', '本周', '本月'])
    w.unmount()
  })

  it('新建按钮打开弹层', async () => {
    const { w } = mountView()
    await w.find('.btn-primary').trigger('click')
    await nextTick()
    const panel = document.body.querySelector('.modal-panel')
    expect(panel).toBeTruthy()
    expect(panel.textContent).toContain('新建任务')
    w.unmount()
  })

  it('点击任务行打开详情抽屉', async () => {
    store.addTodo({ title: '可点任务', timeType: 'datetime', startAt: dayStart() + 10 * 3600000 })
    const { w } = mountView()
    await w.find('.main').trigger('click')
    await nextTick()
    const drawer = document.body.querySelector('.drawer-panel')
    expect(drawer).toBeTruthy()
    expect(drawer.textContent).toContain('可点任务')
    w.unmount()
  })
})

describe('快捷安排时间', () => {
  function mountTodos() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/todos', component: { template: '<div/>' } },
        { path: '/', component: { template: '<div/>' } },
        { path: '/focus', component: { template: '<div/>' } },
        { path: '/projects', component: { template: '<div/>' } },
      ],
    })
    router.push('/todos')
    return mount(TodosView, { global: { plugins: [router] } })
  }

  it('任务行有安排时间按钮，点击打开弹窗并可设置时间段', async () => {
    const d = startOfDayTs(Date.now())
    const t = store.addTodo({ title: '要安排的任务', timeType: 'none' })
    const w = mountTodos()
    await nextTick()
    // 默认「今天」分组下无时间任务不显示，切到全部
    await w.findAll('.seg-item')[0].trigger('click')
    await nextTick()
    const schedBtn = w.findAll('.sched-btn')
    expect(schedBtn.length).toBe(1)
    await schedBtn[0].trigger('click')
    await nextTick()
    const panel = document.body.querySelector('.modal-panel')
    expect(panel).toBeTruthy()
    expect(panel.textContent).toContain('安排时间')
    // 选择「时间段」
    const segs = [...panel.querySelectorAll('.seg-item')]
    segs.find((b) => b.textContent === '时间段').click()
    await nextTick()
    const dates = [...panel.querySelectorAll('input[type="date"]')]
    const times = [...panel.querySelectorAll('input[type="time"]')]
    expect(dates).toHaveLength(2)
    expect(times).toHaveLength(2)
    dates[0].value = fmtDate(d)
    dates[0].dispatchEvent(new Event('input'))
    dates[1].value = fmtDate(addDaysTs(d, 1))
    dates[1].dispatchEvent(new Event('input'))
    await nextTick()
    const save = [...panel.querySelectorAll('button')].find((b) => b.textContent.includes('保存'))
    save.click()
    await nextTick()
    const after = store.state.todos.find((x) => x.id === t.id)
    expect(after.timeType).toBe('range')
    expect(fmtDate(after.startAt)).toBe(fmtDate(d))
    expect(fmtDate(after.endAt)).toBe(fmtDate(addDaysTs(d, 1)))
    w.unmount()
  })

  it('可设为全天/时间点，也可清除时间', async () => {
    const d = startOfDayTs(Date.now())
    const t = store.addTodo({ title: '安排多种', timeType: 'datetime', startAt: d + 10 * 3600000 })
    const w = mountTodos()
    await nextTick()
    await w.findAll('.sched-btn')[0].trigger('click')
    await nextTick()
    const panel = () => document.body.querySelector('.modal-panel')
    // 全天
    ;[...panel().querySelectorAll('.seg-item')].find((b) => b.textContent === '全天').click()
    await nextTick()
    ;[...panel().querySelectorAll('button')].find((b) => b.textContent.includes('保存')).click()
    await nextTick()
    expect(store.state.todos.find((x) => x.id === t.id).timeType).toBe('date')
    // 清除时间
    await w.findAll('.sched-btn')[0].trigger('click')
    await nextTick()
    ;[...panel().querySelectorAll('.seg-item')].find((b) => b.textContent === '无时间').click()
    await nextTick()
    ;[...panel().querySelectorAll('button')].find((b) => b.textContent.includes('保存')).click()
    await nextTick()
    const after = store.state.todos.find((x) => x.id === t.id)
    expect(after.timeType).toBe('none')
    expect(after.startAt).toBeNull()
    w.unmount()
  })

  it('项目内子任务同样有安排时间按钮（网格与列表）', async () => {
    const p = store.addProject({ name: '项目X' })
    store.addSubTask({ projectId: p.id, name: '项目任务A' })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/projects/:id', component: { template: '<div/>' } },
        { path: '/projects', component: { template: '<div/>' } },
        { path: '/todos', component: { template: '<div/>' } },
        { path: '/focus', component: { template: '<div/>' } },
      ],
    })
    await router.push(`/projects/${p.id}`)
    await router.isReady()
    const w = mount(ProjectDetailView, { global: { plugins: [router] } })
    await nextTick()
    // 网格视图：专注按钮旁有安排时间按钮
    const schedBtns = w.findAll('.focus-mini').filter((b) => b.attributes('title') === '安排时间')
    expect(schedBtns.length).toBeGreaterThanOrEqual(1)
    await schedBtns[0].trigger('click')
    await nextTick()
    const panel = document.body.querySelector('.modal-panel')
    expect(panel.textContent).toContain('安排时间')
    const save = [...panel.querySelectorAll('button')].find((b) => b.textContent.includes('保存'))
    save.click()
    await nextTick()
    const task = store.state.todos.find((x) => x.title === '项目任务A')
    expect(task.timeType).not.toBe('none')
    w.unmount()
  })
})

describe('待办页标签栏与收集箱', () => {
  function mountTodos() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/todos', component: { template: '<div/>' } },
        { path: '/', component: { template: '<div/>' } },
        { path: '/focus', component: { template: '<div/>' } },
        { path: '/projects', component: { template: '<div/>' } },
      ],
    })
    router.push('/todos')
    return mount(TodosView, { global: { plugins: [router] } })
  }

  it('顶部横向标签栏：全部 / 收集箱 / 各标签（带数量），点击筛选任务', async () => {
    const d = startOfDayTs(Date.now())
    const tg = store.addTag({ name: '工作', color: '#E11D48' })
    store.addTodo({ title: '带标签任务', timeType: 'date', startAt: d, tagIds: [tg.id] })
    store.addTodo({ title: '无标签任务', timeType: 'date', startAt: d })
    const w = mountTodos()
    await nextTick()
    const chips = w.findAll('.tag-chip').map((c) => c.text())
    expect(chips[0]).toContain('全部')
    expect(chips[1]).toContain('收集箱')
    expect(chips.some((c) => c.includes('工作'))).toBe(true)
    // 默认今天分组：两个任务都显示
    expect(w.text()).toContain('带标签任务')
    expect(w.text()).toContain('无标签任务')
    // 点标签 → 只看该标签任务
    const tagChip = w.findAll('.tag-chip').find((c) => c.text().includes('工作'))
    await tagChip.trigger('click')
    await nextTick()
    expect(w.text()).toContain('带标签任务')
    expect(w.text()).not.toContain('无标签任务')
    // 点收集箱 → 只看无标签任务
    const inbox = w.findAll('.tag-chip').find((c) => c.text().includes('收集箱'))
    await inbox.trigger('click')
    await nextTick()
    expect(w.text()).toContain('无标签任务')
    expect(w.text()).not.toContain('带标签任务')
    // 再点一次取消筛选
    await inbox.trigger('click')
    await nextTick()
    expect(w.text()).toContain('带标签任务')
    w.unmount()
  })

  it('标签数量按当前分组统计，收集箱数量正确', async () => {
    const d = startOfDayTs(Date.now())
    const tg = store.addTag({ name: '学习', color: '#5476B8' })
    store.addTodo({ title: 'A', timeType: 'date', startAt: d, tagIds: [tg.id] })
    store.addTodo({ title: 'B', timeType: 'date', startAt: d, tagIds: [tg.id] })
    store.addTodo({ title: 'C', timeType: 'date', startAt: d })
    const w = mountTodos()
    await nextTick()
    const tagChip = w.findAll('.tag-chip').find((c) => c.text().includes('学习'))
    expect(tagChip.text()).toContain('2')
    const inbox = w.findAll('.tag-chip').find((c) => c.text().includes('收集箱'))
    expect(inbox.text()).toContain('1')
    w.unmount()
  })

})

describe('延期任务的展示', () => {
  it('延期宽限期内：显示「已延期」并展示延期后的实际截止时间', async () => {
    const now = Date.now()
    const t = store.addTodo({ title: '延期的任务', timeType: 'datetime', startAt: now - 7200000 })
    const until = now + 5400000 // 1.5 小时后
    store.updateTodo(t.id, { snoozeUntil: until })
    const item = store.state.todos.find((x) => x.id === t.id)
    const w = mount(TaskItem, { props: { todo: item, depth: 0 } })
    await nextTick()
    expect(w.text()).toContain('已延期')
    expect(w.text()).toContain('延期至')
    // 显示的是延期后的截止时间（含时分）
    const d = new Date(until)
    const expectText = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    expect(w.text()).toContain(expectText)
    // 原定时间已过（晚了 2 小时）但延期期内不算逾期
    expect(w.text()).not.toContain('已逾期')
    w.unmount()
  })

  it('延期时间已过仍显示已逾期（延期失效）', async () => {
    const now = Date.now()
    const t = store.addTodo({ title: '延期过期的任务', timeType: 'datetime', startAt: now - 7200000 })
    store.updateTodo(t.id, { snoozeUntil: now - 3600000 })
    const item = store.state.todos.find((x) => x.id === t.id)
    const w = mount(TaskItem, { props: { todo: item, depth: 0 } })
    await nextTick()
    expect(w.text()).toContain('已逾期')
    expect(w.text()).not.toContain('延期至')
    w.unmount()
  })

  it('首页今日计划：延期任务标注已延期并显示延期截止时间', async () => {
    const now = Date.now()
    const d = startOfDayTs(now)
    const t = store.addTodo({ title: '首页延期任务', timeType: 'datetime', startAt: d + 9 * 3600000 })
    const until = now + 3600000
    store.updateTodo(t.id, { snoozeUntil: until })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div/>' } },
        { path: '/todos', component: { template: '<div/>' } },
        { path: '/blueprints', component: { template: '<div/>' } },
        { path: '/relations', component: { template: '<div/>' } },
        { path: '/projects/:id', component: { template: '<div/>' } },
        { path: '/media', component: { template: '<div/>' } },
        { path: '/food', component: { template: '<div/>' } },
      ],
    })
    router.push('/')
    const HomeView = (await import('../src/views/HomeView.vue')).default
    const w = mount(HomeView, { global: { plugins: [router] } })
    await nextTick()
    expect(w.text()).toContain('首页延期任务')
    expect(w.text()).toContain('已延期 · 延期至')
    w.unmount()
  })
})

describe('随想集', () => {
  it('随想按月自动清理：上个月的随想被删除，本月随想与普通任务保留', () => {
    const nowD = new Date()
    const thisMonth = new Date(nowD.getFullYear(), nowD.getMonth(), 3).getTime()
    const lastMonth = new Date(nowD.getFullYear(), nowD.getMonth() - 1, 3).getTime()

    const oldThought = store.addTodo({ title: '上月的点子', fleeting: true, timeType: 'date', startAt: lastMonth })
    const newThought = store.addTodo({ title: '本月的点子', fleeting: true, timeType: 'date', startAt: thisMonth })
    const normal = store.addTodo({ title: '普通任务', timeType: 'none' })
    // 手动调整创建时间
    store.state.todos.find((t) => t.id === oldThought.id).createdAt = lastMonth
    store.state.todos.find((t) => t.id === newThought.id).createdAt = thisMonth
    store.state.todos.find((t) => t.id === normal.id).createdAt = lastMonth

    const removed = store.purgeFleetingTodos(Date.now())
    expect(removed).toBe(1)
    const titles = store.state.todos.map((t) => t.title)
    expect(titles).not.toContain('上月的点子')
    expect(titles).toContain('本月的点子')
    expect(titles).toContain('普通任务') // 普通任务不会被清理
  })

  it('标签栏有「随想」分类，点击只显示随想；输入框可记录新随想并带标签', async () => {
    const tg = store.addTag({ name: '灵感', color: '#0ea5e9' })
    store.addTodo({ title: '普通任务', timeType: 'date', startAt: startOfDayTs(Date.now()) })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div/>' } }, { path: '/focus', component: { template: '<div/>' } }],
    })
    await router.push('/')
    await router.isReady()
    const w = mount(TodosView, { global: { plugins: [router] } })
    await nextTick()
    expect(w.text()).toContain('随想集')

    // 输入并记录一条随想（带标签）
    await w.find('.f-input').setValue('做一个记账小工具')
    await w.find('.f-tag').setValue(tg.id)
    await w.find('.fleeting-card .btn-primary').trigger('click')
    await nextTick()
    const created = store.state.todos.find((t) => t.title === '做一个记账小工具')
    expect(created).toBeTruthy()
    expect(created.fleeting).toBe(true)
    expect(created.tagIds).toEqual([tg.id])

    // 随想 chip 计数 +1
    const fleetChip = w.findAll('.tag-chip').find((c) => c.text().includes('随想'))
    expect(fleetChip.text()).toContain('1')

    // 点开随想分类：只显示随想
    await fleetChip.trigger('click')
    await nextTick()
    const rows = w.findAll('.task-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('做一个记账小工具')
    // 行上有「随想」徽标
    expect(rows[0].find('.fleet-badge').text()).toBe('随想')
    w.unmount()
  })
})

describe('随想只在自己的分类里可见', () => {
  function mountTodos() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div/>' } }, { path: '/focus', component: { template: '<div/>' } }],
    })
    router.push('/')
    return mount(TodosView, { global: { plugins: [router] } })
  }

  it('常规分组与收集箱/标签筛选里不出现随想，只有「随想」分类能看到', async () => {
    const tg = store.addTag({ name: '灵感', color: '#0ea5e9' })
    store.addTodo({ title: '正经任务', timeType: 'date', startAt: startOfDayTs(Date.now()) })
    store.addTodo({ title: '一个点子', timeType: 'date', startAt: startOfDayTs(Date.now()), fleeting: true, tagIds: [tg.id] })

    const w = mountTodos()
    await nextTick()
    // 默认「今天」分组：只看到正经任务
    expect(w.text()).toContain('正经任务')
    expect(w.text()).not.toContain('一个点子')
    // 切「全部」仍不显示
    await w.findAll('.seg-item')[0].trigger('click')
    await nextTick()
    expect(w.text()).not.toContain('一个点子')
    // 收集箱不显示
    const inbox = w.findAll('.tag-chip').find((c) => c.text().includes('收集箱'))
    await inbox.trigger('click')
    await nextTick()
    expect(w.text()).not.toContain('一个点子')
    // 标签筛选也不显示
    const tagChip = w.findAll('.tag-chip').find((c) => c.text().includes('灵感'))
    await tagChip.trigger('click')
    await nextTick()
    expect(w.text()).not.toContain('一个点子')
    // 只有「随想」分类能看到
    const fleetChip = w.findAll('.tag-chip').find((c) => c.text().includes('随想'))
    await fleetChip.trigger('click')
    await nextTick()
    expect(w.text()).toContain('一个点子')
    w.unmount()
  })

  it('随想不进入首页今日计划与日历', () => {
    const d = startOfDayTs(Date.now())
    const thought = store.addTodo({ title: '闪现的想法', timeType: 'date', startAt: d, fleeting: true })
    // 首页
    const todayRows = []
    for (const t of store.state.todos) {
      if (t.fleeting || t.parentId || t.completed || t.canceled || !todoActiveOnDay(t, d)) continue
      todayRows.push(t.title)
    }
    expect(todayRows).not.toContain('闪现的想法')
    // 日历聚合
    const items = calendarItems(store.state, d, d + DAY_MS)
    expect(items.some((it) => it.todo && it.todo.id === thought.id)).toBe(false)
    // 归档箱也不含随想（即使完成）
    store.toggleTodo(thought.id, true)
    expect(archivedTodos(store.state)).toHaveLength(0)
    // 常规列表选择器排除
    expect(selectDueTodos(store.state.todos, 'all').some((t) => t.id === thought.id)).toBe(false)
  })
})

describe('逾期任务补完成', () => {
  it('补完成：标记完成并把完成时间记到前一天', () => {
    const t = store.addTodo({ title: '昨天没做完', timeType: 'date', startAt: startOfDayTs(Date.now()) - DAY_MS })
    expect(todoOverdue(store.state.todos[0], Date.now())).toBe(true)

    const res = store.completeTodoBackdated(t.id)
    expect(res).toBeTruthy()
    const saved = store.state.todos.find((x) => x.id === t.id)
    expect(saved.completed).toBe(true)
    const expectDay = startOfDayTs(Date.now()) - DAY_MS
    expect(startOfDayTs(saved.completedAt)).toBe(expectDay)
    // 不再算逾期，也不再出现在未完成列表
    expect(todoOverdue(saved, Date.now())).toBe(false)
    expect(selectDueTodos(store.state.todos, 'overdue').some((x) => x.id === t.id)).toBe(false)
    // 进入归档箱
    expect(archivedTodos(store.state).some((x) => x.id === t.id)).toBe(true)
  })

  it('已取消的任务不能补完成', () => {
    const t = store.addTodo({ title: '取消掉的', timeType: 'date', startAt: startOfDayTs(Date.now()) - DAY_MS })
    store.cancelTodo(t.id)
    expect(store.completeTodoBackdated(t.id)).toBeNull()
  })

  it('抽屉里逾期任务显示「补完成」，点击后任务完成并关闭抽屉', async () => {
    const t = store.addTodo({ title: '逾期任务X', timeType: 'datetime', startAt: Date.now() - 6 * 3600000 })
    const w = mount(TaskDrawer, { props: { open: true, todoId: t.id } })
    await nextTick()
    const panel = document.querySelector('.drawer-panel')
    const btn = [...panel.querySelectorAll('button')].find((b) => b.textContent.includes('补完成'))
    expect(btn).toBeTruthy()
    btn.click()
    await nextTick()
    const saved = store.state.todos.find((x) => x.id === t.id)
    expect(saved.completed).toBe(true)
    expect(startOfDayTs(saved.completedAt)).toBe(startOfDayTs(Date.now()) - DAY_MS)
    w.unmount()
  })

  it('未逾期任务不显示「补完成」入口', async () => {
    const t = store.addTodo({ title: '今天的任务', timeType: 'datetime', startAt: Date.now() + 3 * 3600000 })
    const w = mount(TaskDrawer, { props: { open: true, todoId: t.id } })
    await nextTick()
    const panel = document.querySelector('.drawer-panel')
    const btn = [...panel.querySelectorAll('button')].find((b) => b.textContent.includes('补完成'))
    expect(btn).toBeUndefined()
    w.unmount()
  })
})

describe('逾期列表行内补完成', () => {
  function mountTodos() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div/>' } }, { path: '/focus', component: { template: '<div/>' } }],
    })
    router.push('/')
    return mount(TodosView, { global: { plugins: [router] } })
  }

  it('逾期分组的每个任务行都有「补完成」，点击直接完成并记到昨天（无确认弹窗）', async () => {
    const d = startOfDayTs(Date.now())
    const a = store.addTodo({ title: '逾期甲', timeType: 'date', startAt: d - DAY_MS })
    const b = store.addTodo({ title: '逾期乙', timeType: 'date', startAt: d - 2 * DAY_MS })
    store.addTodo({ title: '今天的事', timeType: 'date', startAt: d })

    const w = mountTodos()
    await nextTick()
    await w.findAll('.seg-item')[2].trigger('click') // 逾期分组
    await nextTick()
    const rows = w.findAll('.task-row')
    expect(rows).toHaveLength(2)
    // 每行都有补完成按钮
    expect(rows[0].find('.backfill-btn').exists()).toBe(true)
    expect(rows[1].find('.backfill-btn').exists()).toBe(true)

    await rows[0].find('.backfill-btn').trigger('click')
    await nextTick()
    // 没有确认弹窗
    expect(document.body.querySelector('.confirm-panel')).toBeNull()
    const savedA = store.state.todos.find((x) => x.id === a.id)
    expect(savedA.completed).toBe(true)
    expect(startOfDayTs(savedA.completedAt)).toBe(d - DAY_MS)
    // 列表里少一条
    expect(w.findAll('.task-row')).toHaveLength(1)
    expect(b.id).toBeTruthy()
    w.unmount()
  })

  it('未逾期任务行不显示「补完成」', async () => {
    const d = startOfDayTs(Date.now())
    store.addTodo({ title: '今天的事', timeType: 'date', startAt: d })
    const w = mountTodos()
    await nextTick()
    const row = w.find('.task-row')
    expect(row.exists()).toBe(true)
    expect(row.find('.backfill-btn').exists()).toBe(false)
    w.unmount()
  })
})
