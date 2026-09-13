import { describe, it, expect, beforeEach } from 'vitest'
import { makeStore, MIN, HOUR } from './helpers.js'
import { defaultState, normalizeData } from '../src/store.js'
import { parseDateStr, parseDateTimeStr } from '../src/utils/date.js'

describe('待办 actions', () => {
  let store
  beforeEach(() => {
    ;({ store } = makeStore())
  })

  it('addTodo 生成完整结构与默认值', () => {
    const t = store.addTodo({ title: '写代码' })
    expect(t.id).toBeTruthy()
    expect(t.timeType).toBe('none')
    expect(t.completed).toBe(false)
    expect(t.completedAt).toBeNull()
    expect(t.parentId).toBeNull()
    expect(store.state.todos).toHaveLength(1)
  })

  it('updateTodo 修改字段并归一化时间类型', () => {
    const t = store.addTodo({ title: 'a', timeType: 'range', startAt: 1, endAt: 2 })
    store.updateTodo(t.id, { title: 'b', timeType: 'none' })
    const after = store.state.todos[0]
    expect(after.title).toBe('b')
    expect(after.startAt).toBeNull()
    expect(after.endAt).toBeNull()
  })

  it('toggleTodo 记录/清除 completedAt', () => {
    const t = store.addTodo({ title: 'a' })
    store.toggleTodo(t.id)
    expect(store.state.todos[0].completed).toBe(true)
    expect(store.state.todos[0].completedAt).toBe(1000000000000)
    store.toggleTodo(t.id, false)
    expect(store.state.todos[0].completed).toBe(false)
    expect(store.state.todos[0].completedAt).toBeNull()
  })

  it('addTodo 默认无优先级，可保存高/中/低', () => {
    const t = store.addTodo({ title: '普通' })
    expect(t.priority).toBeNull()
    const h = store.addTodo({ title: '重要', priority: 'high' })
    expect(h.priority).toBe('high')
    store.updateTodo(h.id, { priority: 'low' })
    expect(store.state.todos.find((x) => x.id === h.id).priority).toBe('low')
  })

  it('完成循环任务自动生成下一期副本并保留历史', () => {
    const t0 = parseDateTimeStr('2026-09-02 09:00:00')
    const t = store.addTodo({ title: '每日背单词', timeType: 'datetime', startAt: t0, recurrence: { freq: 'daily', step: 1 } })
    store.toggleTodo(t.id, true)
    expect(store.state.todos).toHaveLength(2)
    const [oldT, next] = store.state.todos
    expect(oldT.completed).toBe(true)
    expect(oldT.completedAt).toBe(1000000000000)
    expect(next.id).not.toBe(oldT.id)
    expect(next.title).toBe('每日背单词')
    expect(next.completed).toBe(false)
    expect(next.startAt).toBe(parseDateTimeStr('2026-09-03 09:00:00'))
    expect(next.recurrence).toEqual({ freq: 'daily', step: 1 })
  })

  it('循环时间段任务按同样时长平移', () => {
    const t0 = parseDateTimeStr('2026-09-02 09:00:00')
    const t = store.addTodo({ title: '每周例会', timeType: 'range', startAt: t0, endAt: t0 + 3600000, recurrence: { freq: 'weekly', step: 1 } })
    store.toggleTodo(t.id, true)
    const next = store.state.todos.find((x) => x.id !== t.id)
    expect(next.startAt).toBe(parseDateTimeStr('2026-09-09 09:00:00'))
    expect(next.endAt).toBe(parseDateTimeStr('2026-09-09 09:00:00') + 3600000)
  })

  it('无时间任务或取消勾选不生成循环副本', () => {
    const a = store.addTodo({ title: '无时间任务', recurrence: { freq: 'daily', step: 1 } })
    store.toggleTodo(a.id, true)
    expect(store.state.todos).toHaveLength(1)
    const b = store.addTodo({ title: '循环任务', timeType: 'date', startAt: parseDateStr('2026-09-02'), recurrence: { freq: 'daily', step: 1 } })
    store.toggleTodo(b.id, true)
    store.toggleTodo(store.state.todos.find((x) => x.title === '循环任务').id, false)
    // 撤销完成不新增副本
    expect(store.state.todos.length).toBe(3)
  })

  it('duplicateTodo 复制内容为全新未完成任务，保持归属', () => {
    const t = store.addTodo({
      title: '原任务',
      note: '备注',
      timeType: 'datetime',
      startAt: parseDateTimeStr('2026-09-03 10:00:00'),
      tagIds: ['t1'],
      priority: 'high',
    })
    store.toggleTodo(t.id, true) // 已完成原件
    const copy = store.duplicateTodo(t.id)
    expect(copy.id).not.toBe(t.id)
    expect(copy.title).toBe('原任务')
    expect(copy.note).toBe('备注')
    expect(copy.timeType).toBe('datetime')
    expect(copy.startAt).toBe(t.startAt)
    expect(copy.tagIds).toEqual(['t1'])
    expect(copy.priority).toBe('high')
    expect(copy.completed).toBe(false)
    expect(copy.completedAt).toBeNull()
    expect(store.state.todos.filter((x) => x.title === '原任务')).toHaveLength(2)
    // 循环任务复制保留周期且不触发新期生成
    const rr = store.addTodo({ title: '周期任务', timeType: 'date', startAt: parseDateStr('2026-09-02'), recurrence: { freq: 'weekly', step: 1 } })
    const rrCopy = store.duplicateTodo(rr.id)
    expect(rrCopy.recurrence).toEqual({ freq: 'weekly', step: 1 })
    expect(store.state.todos.filter((x) => x.title === '周期任务')).toHaveLength(2)
    // 子任务/项目任务保持归属
    const p = store.addProject({ name: 'p' })
    const sub = store.addSubTask({ projectId: p.id, name: '项目里的' })
    const subCopy = store.duplicateTodo(sub.id)
    expect(subCopy.projectId).toBe(p.id)
    expect(subCopy.parentId).toBeNull()
    const child = store.addTodo({ title: '子', parentId: t.id })
    const childCopy = store.duplicateTodo(child.id)
    expect(childCopy.parentId).toBe(t.id)
  })

  it('moveTodo 同级拖拽排序：放到目标之前', () => {
    const a = store.addTodo({ title: 'A' })
    const b = store.addTodo({ title: 'B' })
    const c = store.addTodo({ title: 'C' })
    store.moveTodo(c.id, { parentId: null, beforeId: a.id })
    const order = store.state.todos
      .filter((t) => !t.parentId)
      .sort((x, y) => (x.order || 0) - (y.order || 0))
      .map((t) => t.title)
    expect(order).toEqual(['C', 'A', 'B'])
  })

  it('moveTodo 移动子任务到其它父任务下并重排', () => {
    const p1 = store.addTodo({ title: '父1' })
    const p2 = store.addTodo({ title: '父2' })
    const s1 = store.addTodo({ title: '子1', parentId: p1.id })
    const s2 = store.addTodo({ title: '子2', parentId: p2.id })
    store.moveTodo(s1.id, { parentId: p2.id, beforeId: s2.id })
    const moved = store.state.todos.find((t) => t.id === s1.id)
    expect(moved.parentId).toBe(p2.id)
    const p2Kids = store.state.todos.filter((t) => t.parentId === p2.id).sort((a, b) => a.order - b.order).map((t) => t.title)
    expect(p2Kids).toEqual(['子1', '子2'])
  })

  it('moveTodo 拒绝移入自身子树（防止循环）', () => {
    const root = store.addTodo({ title: '根' })
    const child = store.addTodo({ title: '子', parentId: root.id })
    store.moveTodo(root.id, { parentId: child.id })
    expect(store.state.todos.find((t) => t.id === root.id).parentId).toBeNull()
  })

  it('deleteTodo 级联删除整棵子树', () => {
    const root = store.addTodo({ title: '根' })
    const c1 = store.addTodo({ title: '子1', parentId: root.id })
    const c2 = store.addTodo({ title: '子2', parentId: root.id })
    const gc = store.addTodo({ title: '孙', parentId: c1.id })
    const other = store.addTodo({ title: '其它' })
    store.deleteTodo(root.id)
    const ids = store.state.todos.map((t) => t.id)
    expect(ids).not.toContain(root.id)
    expect(ids).not.toContain(c1.id)
    expect(ids).not.toContain(c2.id)
    expect(ids).not.toContain(gc.id)
    expect(ids).toContain(other.id)
  })
})

describe('项目 actions', () => {
  let store
  beforeEach(() => {
    ;({ store } = makeStore())
  })

  it('addProject 默认按数量统计模式，可指定累计时长模式', () => {
    const p = store.addProject({ name: '默认项目' })
    expect(p.type).toBe('学习')
    expect(p.progressMode).toBe('count')
    const p2 = store.addProject({ name: '计时项目', progressMode: 'hours', totalWorkload: 12 })
    expect(p2.progressMode).toBe('hours')
    store.updateProject(p2.id, { progressMode: 'count' })
    expect(store.state.projects.find((x) => x.id === p2.id).progressMode).toBe('count')
  })

  it('项目任务支持预计时长（小时）与顺序归属', () => {
    const p = store.addProject({ name: 'p' })
    const s = store.addSubTask({ projectId: p.id, name: 'x' })
    expect(s.estimatedHours).toBe(0)
    expect(s.projectId).toBe(p.id)
    expect(s.parentId).toBeNull()
    const s2 = store.addSubTask({ projectId: p.id, name: 'y', estimatedHours: 3.5, dueAt: 123 })
    expect(s2.estimatedHours).toBe(3.5)
    expect(s2.timeType).toBe('datetime')
    expect(s2.startAt).toBe(123)
    expect(s.order).toBe(0)
    expect(s2.order).toBe(1)
    store.updateSubTask(s.id, { estimatedHours: 2 })
    expect(store.state.todos.find((x) => x.id === s.id).estimatedHours).toBe(2)
  })

  it('cycleSubTaskStatus 按勾选切换 完成/未完成（普通待办语义）', () => {
    const p = store.addProject({ name: 'p' })
    const s = store.addSubTask({ projectId: p.id, name: 'x' })
    store.cycleSubTaskStatus(s.id)
    const t = store.state.todos.find((x) => x.id === s.id)
    expect(t.completed).toBe(true)
    expect(t.completedAt).toBe(1000000000000)
    store.cycleSubTaskStatus(s.id)
    expect(t.completed).toBe(false)
    expect(t.completedAt).toBeNull()
  })

  it('setSubTaskOnHome 开关（保留兼容字段）', () => {
    const p = store.addProject({ name: 'p' })
    const s = store.addSubTask({ projectId: p.id, name: 'x' })
    store.setSubTaskOnHome(s.id, true)
    expect(store.state.todos.find((x) => x.id === s.id).onHome).toBe(true)
    store.setSubTaskOnHome(s.id, false)
    expect(store.state.todos.find((x) => x.id === s.id).onHome).toBe(false)
  })

  it('archiveProject 标记完成', () => {
    const p = store.addProject({ name: 'p' })
    store.archiveProject(p.id)
    expect(store.state.projects[0].completed).toBe(true)
    expect(store.state.projects[0].completedAt).toBe(1000000000000)
  })

  it('deleteProject 级联删除其任务（含 todo 子任务树）', () => {
    const p = store.addProject({ name: 'p' })
    const a = store.addSubTask({ projectId: p.id, name: 'a' })
    const b = store.addSubTask({ projectId: p.id, name: 'b' })
    const child = store.addTodo({ title: 'a的子', parentId: a.id })
    const other = store.addTodo({ title: '无关任务' })
    store.deleteProject(p.id)
    expect(store.state.projects).toHaveLength(0)
    const ids = store.state.todos.map((t) => t.id)
    expect(ids).not.toContain(a.id)
    expect(ids).not.toContain(b.id)
    expect(ids).not.toContain(child.id)
    expect(ids).toContain(other.id)
  })

  it('migrateLegacySubTasks 把旧版项目子任务并入 todos', () => {
    const p = store.addProject({ name: 'p' })
    const legacy = [
      { id: 'L1', projectId: p.id, name: '旧任务A', status: 'done', dueAt: 1000, completedAt: 999, onHome: true, estimatedHours: 2, tagIds: ['t9'], createdAt: 1 },
      { id: 'L2', projectId: p.id, name: '旧任务B', status: 'doing', dueAt: null, onHome: false, estimatedHours: 0, tagIds: [], createdAt: 2 },
    ]
    store.state.projectSubTasks.push(...legacy)
    expect(store.migrateLegacySubTasks()).toBe(true)
    const a = store.state.todos.find((x) => x.id === 'L1')
    expect(a.title).toBe('旧任务A')
    expect(a.projectId).toBe(p.id)
    expect(a.completed).toBe(true)
    expect(a.completedAt).toBe(999)
    expect(a.timeType).toBe('datetime')
    expect(a.startAt).toBe(1000)
    expect(a.onHome).toBe(true)
    expect(a.estimatedHours).toBe(2)
    const b = store.state.todos.find((x) => x.id === 'L2')
    expect(b.completed).toBe(false)
    expect(b.timeType).toBe('none')
    expect(store.state.projectSubTasks).toHaveLength(0)
    expect(store.migrateLegacySubTasks()).toBe(false)
  })
})

describe('打卡 actions', () => {
  let store
  beforeEach(() => {
    ;({ store } = makeStore())
  })

  it('addCheckin 归一化日期与 fixedDurationMin', () => {
    const c = store.addCheckin({ name: '喝水', dailyTargetCount: 8, fixedDurationMin: '30', startDate: '2026-09-01' })
    expect(c.fixedDurationMin).toBe(30)
    expect(c.startDate).toBe(new Date(2026, 8, 1).getTime())
    expect(c.endDate).toBeNull()
  })

  it('addCheckin 默认固定次数规则，可保存计数模式与不限次数', () => {
    const c = store.addCheckin({ name: '默认' })
    expect(c.rule).toBe('fixed')
    expect(c.countUnlimited).toBe(false)
    const c2 = store.addCheckin({ name: '计数', rule: 'count', countUnlimited: true })
    expect(c2.rule).toBe('count')
    expect(c2.countUnlimited).toBe(true)
    store.updateCheckin(c.id, { rule: 'count', countUnlimited: true })
    expect(store.state.checkins[0].rule).toBe('count')
    expect(store.state.checkins[0].countUnlimited).toBe(true)
  })

  it('addCheckinRecord / deleteCheckinRecord', () => {
    const c = store.addCheckin({ name: 'x' })
    const r = store.addCheckinRecord(c.id, { durationMin: 20 })
    expect(store.state.checkinRecords).toHaveLength(1)
    expect(r.durationMin).toBe(20)
    store.deleteCheckinRecord(r.id)
    expect(store.state.checkinRecords).toHaveLength(0)
  })

  it('打卡记录可携带日志备注', () => {
    const c = store.addCheckin({ name: '阅读' })
    const r = store.addCheckinRecord(c.id, { durationMin: 30, note: '今天读得很专注' })
    expect(r.note).toBe('今天读得很专注')
    const r2 = store.addCheckinRecord(c.id, {})
    expect(r2.note).toBe('')
  })

  it('deleteCheckin 级联删除记录', () => {
    const c = store.addCheckin({ name: 'x' })
    store.addCheckinRecord(c.id, {})
    store.deleteCheckin(c.id)
    expect(store.state.checkins).toHaveLength(0)
    expect(store.state.checkinRecords).toHaveLength(0)
  })
})

describe('标签 actions', () => {
  let store
  beforeEach(() => {
    ;({ store } = makeStore())
  })

  it('addTag / updateTag', () => {
    const tg = store.addTag({ name: '重要', color: '#E11D48' })
    expect(store.state.tags).toHaveLength(1)
    store.updateTag(tg.id, { name: '紧急' })
    expect(store.state.tags[0].name).toBe('紧急')
  })

  it('deleteTag 解绑全部关联实体', () => {
    const tg = store.addTag({ name: 't' })
    const todo = store.addTodo({ title: 'x', tagIds: [tg.id] })
    const p = store.addProject({ name: 'p', tagIds: [tg.id] })
    const s = store.addSubTask({ projectId: p.id, name: 's', tagIds: [tg.id] })
    store.deleteTag(tg.id)
    expect(store.state.tags).toHaveLength(0)
    expect(store.state.todos.find((x) => x.id === todo.id).tagIds).toEqual([])
    expect(store.state.projects.find((x) => x.id === p.id).tagIds).toEqual([])
    expect(store.state.todos.find((x) => x.id === s.id).tagIds).toEqual([])
  })
})

describe('复盘 actions', () => {
  let store
  beforeEach(() => {
    ;({ store } = makeStore())
  })

  it('addReview 五字段默认空，updateReview 合并 fields', () => {
    const r = store.addReview({ type: 'day', periodDate: 100 })
    expect(r.fields.plan).toBe('')
    expect(r.fields.summary).toBe('')
    store.updateReview(r.id, { fields: { plan: '计划A', problems: '问题' } })
    const after = store.state.reviews[0]
    expect(after.fields.plan).toBe('计划A')
    expect(after.fields.problems).toBe('问题')
    expect(after.fields.summary).toBe('')
  })

  it('deleteReview', () => {
    const r = store.addReview({})
    store.deleteReview(r.id)
    expect(store.state.reviews).toHaveLength(0)
  })
})

describe('设置与持久化', () => {
  it('setSetting 白名单与主题联动', () => {
    const { store } = makeStore()
    store.setSetting('theme', 'fog')
    expect(store.state.settings.theme).toBe('fog')
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#E3EBF2')
    store.setSetting('badKey', 1)
    expect(store.state.settings.badKey).toBeUndefined()
  })

  it('persistNow 写入存储介质', async () => {
    const { store, dbImpl } = makeStore()
    store.addTodo({ title: 'x' })
    await store.persistNow()
    const saved = await dbImpl.load()
    expect(saved.todos).toHaveLength(1)
  })

  it('init 载入已有数据', async () => {
    const { store, dbImpl } = makeStore()
    await dbImpl.save({ ...defaultState(), todos: [{ id: 't1', title: '已存' }] })
    await store.init()
    expect(store.state.todos[0].title).toBe('已存')
  })

  it('init 无数据时写入默认', async () => {
    const { store, dbImpl } = makeStore()
    await store.init()
    const saved = await dbImpl.load()
    expect(saved.todos).toEqual([])
  })

  it('exportData 返回可 JSON 化的普通对象', () => {
    const { store } = makeStore()
    store.addTodo({ title: 'a' })
    store.addTag({ name: 't' })
    const data = store.exportData()
    expect(Array.isArray(data.todos)).toBe(true)
    expect(data.todos[0].title).toBe('a')
    const round = JSON.parse(JSON.stringify(data))
    expect(round.todos).toHaveLength(1)
  })

  it('importData 校验、先备份再覆盖', async () => {
    const { store, dbImpl } = makeStore()
    store.addTodo({ title: '旧数据' })
    await store.persistNow()
    const raw = normalizeData({ version: 1, todos: [{ id: 'new1', title: '新数据' }] })
    await store.importData(raw)
    expect(store.state.todos[0].title).toBe('新数据')
    const backup = (await dbImpl.restoreBackup())
    expect(backup.todos[0].title).toBe('旧数据')
  })

  it('导出→导入→再导出一致（全字段闭环）', async () => {
    const { store: src } = makeStore()
    // 尽量覆盖各集合与新增字段
    src.addTag({ name: '工作', color: '#123456' })
    const a = src.addTodo({ title: 'A', note: 'n', timeType: 'datetime', startAt: 1700000000000, tagIds: [src.state.tags[0].id], priority: 'high' })
    src.updateTodo(a.id, { snoozeUntil: 1710000000000 })
    const sub = src.addTodo({ title: '子', parentId: src.state.todos[0].id, timeType: 'date', startAt: 1700000000000 })
    const p = src.addProject({ name: '项目', deadline: 1750000000000 })
    src.addSubTask({ projectId: p.id, name: '项目任务', dueAt: 1760000000000, tagIds: [src.state.tags[0].id] })
    const bp = src.addBlueprint({ title: '蓝图', goalStartTs: 1800000000000, goalEndTs: 1900000000000, dimension: 'study', status: 'doing', notes: '笔记' })
    src.syncRelated(bp.id, [{ type: 'todo', id: src.state.todos[0].id }, { type: 'project', id: p.id }])
    src.addCheckin({ name: '晨跑', dailyTargetCount: 1 })
    src.addCheckinRecord(src.state.checkins[0].id, { count: 1, durationMin: 20 })
    src.addSession({ mode: 'pomodoro', startAt: 1690000000000, endAt: 1690000000000 + 1500000, durationMin: 25 })
    src.addReview({ type: 'day', fields: { summary: '还不错' } })
    src.setSetting('showBlueprintsOnCalendar', true)
    src.addBlueprintDimension('家庭')
    src.state.settings.homeOrder = ['todayTodos', 'blueprints', 'projects']

    const exported = src.exportData()
    // 结构检查：所有核心数组都在
    for (const k of ['tags', 'todos', 'projects', 'projectSubTasks', 'checkins', 'checkinRecords', 'sessions', 'reviews', 'blueprints', 'relations']) {
      expect(Array.isArray(exported[k]), k).toBe(true)
    }
    // 新设备导入同一份数据
    const { store: dst } = makeStore()
    const missing = await dst.importData(exported)
    expect(missing).toEqual([])
    // 再导出与源结构一致（数量与关键字段）
    const re = dst.exportData()
    expect(re.todos).toHaveLength(exported.todos.length)
    expect(re.blueprints).toHaveLength(1)
    expect(re.blueprints[0].goalEndTs).toBe(1900000000000)
    expect(dst.state.blueprints[0].related).toContainEqual({ type: 'todo', id: dst.state.todos[0].id })
    expect(dst.state.todos[0].blueprintIds).toContain(bp.id)
    expect(dst.state.todos[0].snoozeUntil).toBe(1710000000000)
    expect(dst.state.settings.blueprintDims).toHaveLength(1)
    expect(dst.state.settings.showBlueprintsOnCalendar).toBe(true)
    expect(dst.state.reviews).toHaveLength(1)
  })

  it('importData 宽容缺失块：缺 tags/blueprints 仍导入其余数据', async () => {
    const { store } = makeStore()
    store.addTodo({ title: '保留的任务' })
    const raw = store.exportData()
    delete raw.tags
    delete raw.blueprints
    const missing = await store.importData(raw)
    expect(missing).toEqual(expect.arrayContaining(['tags', 'blueprints']))
    expect(store.state.todos.some((x) => x.title === '保留的任务')).toBe(true)
    expect(store.state.tags).toEqual([])
  })

  it('importData 拒绝结构不完整数据', async () => {
    const { store } = makeStore()
    await expect(store.importData({ todos: 'xx' })).rejects.toThrow()
  })

  it('clearAll 备份后恢复默认', async () => {
    const { store, dbImpl } = makeStore()
    store.addTodo({ title: 'a' })
    await store.persistNow()
    await store.clearAll()
    expect(store.state.todos).toHaveLength(0)
    expect(store.state.settings.theme).toBe('ink')
    const backup = await dbImpl.restoreBackup()
    expect(backup.todos).toHaveLength(1)
  })

  it('normalizeData 容错缺失字段', () => {
    const d = normalizeData(null)
    expect(d.todos).toEqual([])
    const d2 = normalizeData({ version: 2, todos: [1], settings: { theme: 'aqua' } })
    expect(d2.version).toBe(2)
    expect(d2.settings.theme).toBe('aqua')
    expect(d2.settings.pomodoroFocusMin).toBe(25)
  })
})

describe('专注状态机', () => {
  it('自由模式：开始→暂停→继续→结束，净时长正确', () => {
    const { store, clock } = makeStore()
    store.startFocusRun({ mode: 'free', targetType: 'todo', targetId: 't1' })
    expect(store.focusState.phase).toBe('run')
    clock.v += 10 * MIN
    store.pauseFocusRun()
    expect(store.focusState.phase).toBe('pause')
    clock.v += 3 * MIN
    store.resumeFocusRun()
    clock.v += 10 * MIN
    store.endFocusRun({})
    expect(store.focusState.phase).toBe('idle')
    expect(store.state.sessions).toHaveLength(1)
    const s = store.state.sessions[0]
    expect(s.durationMin).toBe(20)
    expect(s.mode).toBe('free')
    expect(s.targetType).toBe('todo')
    expect(s.targetId).toBe('t1')
  })

  it('番茄模式：到点自动完成进入休息，休息结束回 idle', () => {
    const { store, clock } = makeStore()
    store.startFocusRun({ mode: 'pomodoro' })
    clock.v += 25 * MIN
    store.focusTick()
    expect(store.focusState.phase).toBe('break')
    expect(store.state.sessions).toHaveLength(1)
    const s = store.state.sessions[0]
    expect(s.mode).toBe('pomodoro')
    expect(s.plannedMinutes).toBe(25)
    expect(s.durationMin).toBe(25)
    clock.v += 5 * MIN
    store.focusTick()
    expect(store.focusState.phase).toBe('idle')
  })

  it('打卡项目专注：一轮番茄完成自动记一次打卡（含时长）', () => {
    const { store, clock } = makeStore()
    const c = store.addCheckin({ name: '冥想', dailyTargetCount: 1, fixedDurationMin: 25 })
    store.startFocusRun({ mode: 'pomodoro', targetType: 'checkin', targetId: c.id })
    clock.v += 25 * MIN
    store.focusTick()
    expect(store.focusState.phase).toBe('break')
    expect(store.state.sessions).toHaveLength(1)
    expect(store.state.sessions[0].targetType).toBe('checkin')
    expect(store.state.sessions[0].targetId).toBe(c.id)
    expect(store.state.checkinRecords).toHaveLength(1)
    const r = store.state.checkinRecords[0]
    expect(r.checkinId).toBe(c.id)
    expect(r.count).toBe(1)
    expect(r.durationMin).toBe(25)
    expect(r.note).toBe('专注完成')
  })

  it('breakRemainMs 与 skipBreak', () => {
    const { store, clock } = makeStore()
    store.startFocusRun({ mode: 'pomodoro' })
    clock.v += 25 * MIN
    store.focusTick()
    expect(store.focusState.phase).toBe('break')
    clock.v += 2 * MIN
    expect(store.breakRemainMs()).toBe(3 * MIN)
    store.skipBreak()
    expect(store.focusState.phase).toBe('idle')
  })

  it('openFocus / closeFocus 控制浮层可见性', () => {
    const { store } = makeStore()
    store.openFocus({ mode: 'pomodoro', targetType: 'projectSub', targetId: 's1' })
    expect(store.focusState.visible).toBe(true)
    expect(store.focusState.targetId).toBe('s1')
    store.closeFocus()
    expect(store.focusState.visible).toBe(false)
  })

  it('净时长不足 1 分钟时手动结束不落库', () => {
    const { store, clock } = makeStore()
    store.startFocusRun({ mode: 'free' })
    clock.v += 30 * 1000
    store.endFocusRun({})
    expect(store.state.sessions).toHaveLength(0)
    expect(store.focusState.phase).toBe('idle')
  })

  it('自由模式 1 分半净时长取整为 2 分钟', () => {
    const { store, clock } = makeStore()
    store.startFocusRun({ mode: 'free' })
    clock.v += 90 * 1000
    store.endFocusRun({})
    expect(store.state.sessions[0].durationMin).toBe(2)
  })
})
