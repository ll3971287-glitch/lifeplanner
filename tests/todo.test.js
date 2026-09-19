import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { todoOverdue } from '../src/selectors.js'
import { parseDateStr, parseDateTimeStr, startOfDayTs, addDaysTs, DAY_MS, fmtDate } from '../src/utils/date.js'
import TodoFormModal from '../src/components/todo/TodoFormModal.vue'
import TaskItem from '../src/components/todo/TaskItem.vue'
import TaskDrawer from '../src/components/todo/TaskDrawer.vue'
import TodosView from '../src/views/TodosView.vue'
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

  it('逾期任务可推迟：推迟期内不算逾期，可调整/取消', async () => {
    const t = store.addTodo({ title: '过期汇报', timeType: 'datetime', startAt: Date.now() - 3600000 })
    expect(todoOverdue(t, Date.now())).toBe(true)
    // 抽屉为逾期任务提供推迟入口
    const w = mount(TaskDrawer, { props: { open: true, todoId: t.id } })
    await nextTick()
    const panel = document.querySelector('.drawer-panel')
    expect(panel.textContent).toContain('已逾期')
    const delayBtn = [...panel.querySelectorAll('button')].find((b) => b.textContent.includes('推迟'))
    expect(delayBtn).toBeTruthy()
    w.unmount()
    // 推迟期内不算逾期，到期未完成恢复逾期，取消推迟立即恢复逾期
    const future = Date.now() + 3600000
    store.updateTodo(t.id, { snoozeUntil: future })
    let t2 = store.state.todos.find((x) => x.id === t.id)
    expect(t2.snoozeUntil).toBe(future)
    expect(todoOverdue(t2, Date.now())).toBe(false)
    expect(todoOverdue(t2, future + 1000)).toBe(true)
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
    store.addTodo({ title: '要取消的任务', timeType: 'date', startAt: dayStart() })
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
    store.addTodo({ title: '今天任务', timeType: 'date', startAt: dayStart() })
    store.addTodo({ title: '昨天任务', timeType: 'date', startAt: dayStart() - DAY_MS })
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
    // 本周 / 本月：昨天与今天都在范围内
    await segs[3].trigger('click')
    await nextTick()
    expect(w.findAll('.task-row')).toHaveLength(2)
    await segs[4].trigger('click')
    await nextTick()
    expect(w.findAll('.task-row')).toHaveLength(2)
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
