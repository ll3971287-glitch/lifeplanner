import { reactive } from 'vue'
import { db } from './db.js'
import { applyTheme } from './theme.js'
import { nextRecurrenceTs } from './utils/date.js'

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export function defaultState() {
  return {
    version: 1,
    settings: {
      theme: 'ink',
      mode: 'light',
      style: 'glass',
      pomodoroFocusMin: 25,
      pomodoroBreakMin: 5,
      dailyFocusGoalMin: 120,
      navOrder: ['home', 'todos', 'projects', 'calendar', 'checkins'],
      homeOrder: ['todayTodos', 'blueprints', 'projects', 'focus', 'checkins', 'dueSoon', 'reviews'],
      showProjectsOnHome: true,
      showBlueprintsOnCalendar: false,
      soundOn: true,
      focusChain: {
        triggerText: '深呼吸三次，把手机放到一边',
        markText: '打开要做的文件，写下今天最重要的一件事',
        reserveMin: 10,
      },
      blueprintDims: [],
    },
    tags: [],
    todos: [],
    projects: [],
    projectSubTasks: [],
    checkins: [],
    checkinRecords: [],
    sessions: [],
    reviews: [],
    blueprints: [],
    relations: [],
    goals: [],
    goalNotes: {},
  }
}

const TODO_PATCH_KEYS = ['title', 'note', 'timeType', 'startAt', 'endAt', 'tagIds', 'parentId', 'recurrence', 'priority', 'projectId', 'estimatedHours', 'onHome', 'snoozeUntil']
const PROJECT_PATCH_KEYS = ['name', 'type', 'desc', 'totalWorkload', 'workloadUnit', 'deadline', 'tagIds', 'completed', 'completedAt', 'progressMode', 'category']
const CHECKIN_PATCH_KEYS = ['name', 'unit', 'dailyTargetCount', 'fixedDurationMin', 'startDate', 'endDate', 'rule', 'countUnlimited']
const REVIEW_PATCH_KEYS = ['type', 'periodDate', 'fields', 'goals']
const TAG_PATCH_KEYS = ['name', 'color']
const SETTINGS_KEYS = ['theme', 'mode', 'style', 'pomodoroFocusMin', 'pomodoroBreakMin', 'dailyFocusGoalMin', 'navOrder', 'homeOrder', 'showProjectsOnHome', 'showBlueprintsOnCalendar', 'blueprintDims', 'focusChain', 'soundOn']
const BLUEPRINT_PATCH_KEYS = ['title', 'goalDateTs', 'goalStartTs', 'goalEndTs', 'goalText', 'dimension', 'desc', 'status', 'notes', 'level']
const RELATION_PATCH_KEYS = ['name', 'gender', 'age', 'birthYear', 'birthMonth', 'birthDay', 'place', 'affinity', 'note']
const GOAL_PATCH_KEYS = ['name', 'desc', 'done', 'year', 'scope', 'index', 'order']

function clampAffinity(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 3
  return Math.max(1, Math.min(5, n))
}

function patch(obj, patchObj, keys) {
  for (const k of keys) {
    if (k in patchObj) obj[k] = patchObj[k]
  }
}

export function normalizeData(raw) {
  const def = defaultState()
  const out = { ...def }
  if (raw && typeof raw === 'object') {
    if (typeof raw.version === 'number') out.version = raw.version
    for (const arr of ['tags', 'todos', 'projects', 'projectSubTasks', 'checkins', 'checkinRecords', 'sessions', 'reviews', 'blueprints', 'relations', 'goals']) {
      if (Array.isArray(raw[arr])) out[arr] = raw[arr]
    }
    if (raw.goalNotes && typeof raw.goalNotes === 'object' && !Array.isArray(raw.goalNotes)) {
      out.goalNotes = { ...raw.goalNotes }
    }
    if (raw.settings && typeof raw.settings === 'object') {
      out.settings = { ...def.settings, ...raw.settings }
    }
  }
  return out
}

export function createStore({ dbImpl = db, now = () => Date.now() } = {}) {
  const state = reactive(defaultState())
  const focusState = reactive({
    visible: false,
    mode: 'pomodoro',
    phase: 'idle', // idle | run | pause | break
    targetType: 'none', // none | todo | projectSub
    targetId: null,
    runStartTs: 0,
    accumMs: 0,
    breakStartTs: 0,
  })

  let saveTimer = null
  let saveSeq = Promise.resolve()

  function persistNow() {
    saveSeq = saveSeq.then(() => dbImpl.save(state)).catch((e) => console.error('[store] 保存失败', e))
    return saveSeq
  }

  function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => persistNow(), 500)
  }

  // ---------- 待办 ----------
  function addTodo({ title, note = '', timeType = 'none', startAt = null, endAt = null, tagIds = [], parentId = null, recurrence = null, priority = null, projectId = null, estimatedHours = 0, onHome = false } = {}) {
    const todo = {
      id: uid(),
      title,
      note,
      timeType,
      startAt,
      endAt,
      tagIds: tagIds || [],
      parentId,
      recurrence: recurrence || null,
      priority: priority || null,
      projectId: projectId || null,
      estimatedHours: Number(estimatedHours) || 0,
      onHome: !!onHome,
      completed: false,
      completedAt: null,
      snoozeUntil: null,
      order: state.todos.length,
      createdAt: now(),
    }
    state.todos.push(todo)
    scheduleSave()
    return todo
  }

  function updateTodo(id, p) {
    const t = state.todos.find((x) => x.id === id)
    if (!t) return null
    patch(t, p, TODO_PATCH_KEYS)
    if ('timeType' in p) {
      if (p.timeType === 'none') {
        t.startAt = null
        t.endAt = null
      } else if (p.timeType === 'date') {
        t.startAt = t.startAt != null ? new Date(new Date(t.startAt).getFullYear(), new Date(t.startAt).getMonth(), new Date(t.startAt).getDate()).getTime() : null
        t.endAt = null
      } else if (p.timeType === 'datetime') {
        t.endAt = null
      }
    }
    scheduleSave()
    return t
  }

  function subtreeIds(id) {
    const out = [id]
    const stack = [id]
    while (stack.length) {
      const pid = stack.pop()
      for (const t of state.todos) {
        if (t.parentId === pid) {
          out.push(t.id)
          stack.push(t.id)
        }
      }
    }
    return out
  }

  function deleteTodo(id) {
    const ids = new Set(subtreeIds(id))
    state.todos = state.todos.filter((t) => !ids.has(t.id))
    scheduleSave()
  }

  // 拖拽排序/调整层级：把任务移动到某父级下的某兄弟之前（beforeId 为空则追加到末尾）
  function moveTodo(draggedId, { parentId = null, beforeId = null } = {}) {
    const t = state.todos.find((x) => x.id === draggedId)
    if (!t) return
    if (parentId && subtreeIds(draggedId).includes(parentId)) return // 不能移动到自己的子树内
    const targetParent = parentId || null
    const siblings = state.todos
      .filter((x) => x.parentId === targetParent && x.id !== draggedId)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
    let idx = beforeId ? siblings.findIndex((s) => s.id === beforeId) : siblings.length
    if (idx < 0) idx = siblings.length
    siblings.splice(idx, 0, t)
    siblings.forEach((s, i) => {
      s.order = i
    })
    t.parentId = targetParent
    scheduleSave()
  }

  function spawnRecurring(t) {
    const rec = t.recurrence
    if (!rec || t.startAt == null) return
    const nextStart = nextRecurrenceTs(t.startAt, rec.freq, rec.step || 1)
    if (nextStart <= t.startAt) return
    const delta = nextStart - t.startAt
    const sameParent = t.parentId ? state.todos.filter((x) => x.parentId === t.parentId) : state.todos.filter((x) => !x.parentId)
    const nextOrder = sameParent.length ? Math.max(...sameParent.map((x) => x.order || 0)) + 1 : 0
    const copy = {
      id: uid(),
      title: t.title,
      note: t.note,
      timeType: t.timeType,
      startAt: nextStart,
      endAt: t.endAt != null ? t.endAt + delta : null,
      tagIds: [...(t.tagIds || [])],
      parentId: t.parentId,
      recurrence: rec,
      priority: t.priority || null,
      projectId: t.projectId || null,
      estimatedHours: Number(t.estimatedHours) || 0,
      onHome: !!t.onHome,
      completed: false,
      completedAt: null,
      order: nextOrder,
      createdAt: now(),
    }
    state.todos.push(copy)
  }

  function toggleTodo(id, done) {
    const t = state.todos.find((x) => x.id === id)
    if (!t) return
    const target = done != null ? done : !t.completed
    t.completed = target
    t.completedAt = target ? now() : null
    if (target) spawnRecurring(t)
    scheduleSave()
  }

  // 复制一份待办任务：内容一致、始终未完成；子任务/项目任务保持归属
  function duplicateTodo(id) {
    const t = state.todos.find((x) => x.id === id)
    if (!t) return null
    const copy = addTodo({
      title: t.title,
      note: t.note,
      timeType: t.timeType,
      startAt: t.startAt,
      endAt: t.endAt,
      tagIds: [...(t.tagIds || [])],
      parentId: t.parentId,
      recurrence: t.recurrence ? { ...t.recurrence } : null,
      priority: t.priority || null,
      projectId: t.projectId || null,
      estimatedHours: t.estimatedHours || 0,
      onHome: !!t.onHome,
    })
    scheduleSave()
    return copy
  }

  // ---------- 项目 ----------
  function addProject({ name, type = '学习', desc = '', totalWorkload = 0, workloadUnit = '小时', deadline = null, tagIds = [], progressMode = 'count', category = null } = {}) {
    const p = {
      id: uid(),
      name,
      type,
      category: category || 'project',
      desc,
      totalWorkload,
      workloadUnit,
      deadline,
      tagIds: tagIds || [],
      completed: false,
      completedAt: null,
      order: state.projects.length,
      createdAt: now(),
      progressMode,
    }
    state.projects.push(p)
    scheduleSave()
    return p
  }

  function updateProject(id, p) {
    const proj = state.projects.find((x) => x.id === id)
    if (!proj) return null
    patch(proj, p, PROJECT_PATCH_KEYS)
    scheduleSave()
    return proj
  }

  function deleteProject(id) {
    state.projects = state.projects.filter((p) => p.id !== id)
    // 级联删除该项目全部任务（含其 todo 子任务树）
    const projectRoots = state.todos.filter((t) => t.projectId === id)
    const ids = new Set()
    for (const r of projectRoots) for (const sid of subtreeIds(r.id)) ids.add(sid)
    state.todos = state.todos.filter((t) => !ids.has(t.id))
    scheduleSave()
  }

  function archiveProject(id) {
    const proj = state.projects.find((x) => x.id === id)
    if (!proj) return
    proj.completed = true
    proj.completedAt = now()
    scheduleSave()
  }

  // ---------- 项目任务 = 带 projectId 的普通待办（模型统一）----------
  // 旧版 projectSubTasks 集合一次性迁移进 todos（幂等：只有残留数据时才生效）
  function migrateLegacySubTasks() {
    if (!state.projectSubTasks.length) return false
    for (const s of state.projectSubTasks) {
      const done = s.status === 'done'
      state.todos.push({
        id: s.id,
        title: s.name || '未命名任务',
        note: '',
        timeType: s.dueAt != null ? 'datetime' : 'none',
        startAt: s.dueAt || null,
        endAt: null,
        tagIds: s.tagIds || [],
        parentId: null,
        recurrence: null,
        priority: null,
        projectId: s.projectId || null,
        estimatedHours: Number(s.estimatedHours) || 0,
        onHome: !!s.onHome,
        completed: done,
        completedAt: done ? s.completedAt || now() : null,
        order: state.todos.length,
        createdAt: s.createdAt || now(),
      })
    }
    state.projectSubTasks = []
    return true
  }

  // 兼容旧调用：创建/更新“项目任务”即操作普通 todo
  function addSubTask({ projectId, name, dueAt = null, onHome = false, tagIds = [], estimatedHours = 0, note = '' } = {}) {
    return addTodo({ title: name, note, timeType: dueAt != null ? 'datetime' : 'none', startAt: dueAt, endAt: null, tagIds, projectId, estimatedHours, onHome })
  }

  function updateSubTask(id, p) {
    const t = state.todos.find((x) => x.id === id)
    if (!t) return null
    const mapped = {}
    if ('name' in p) mapped.title = p.name
    if ('note' in p) mapped.note = p.note
    if ('dueAt' in p) {
      if (p.dueAt != null) {
        mapped.timeType = 'datetime'
        mapped.startAt = p.dueAt
      } else {
        mapped.timeType = 'none'
      }
      mapped.endAt = null
    }
    if ('onHome' in p) mapped.onHome = !!p.onHome
    if ('tagIds' in p) mapped.tagIds = p.tagIds
    if ('estimatedHours' in p) mapped.estimatedHours = p.estimatedHours
    if ('status' in p) {
      const done = p.status === 'done'
      t.completed = done
      t.completedAt = done ? now() : null
    }
    patch(t, mapped, TODO_PATCH_KEYS)
    scheduleSave()
    return t
  }

  function deleteSubTask(id) {
    deleteTodo(id)
  }

  function cycleSubTaskStatus(id) {
    toggleTodo(id)
  }

  function setSubTaskOnHome(id, onHome) {
    const t = state.todos.find((x) => x.id === id)
    if (!t) return
    t.onHome = !!onHome
    scheduleSave()
  }

  // ---------- 打卡 ----------
  function addCheckin({ name, unit = '次', dailyTargetCount = 1, fixedDurationMin = null, startDate = null, endDate = null, rule = 'fixed', countUnlimited = false } = {}) {
    const c = {
      id: uid(),
      name,
      unit,
      dailyTargetCount,
      fixedDurationMin: fixedDurationMin == null ? null : Number(fixedDurationMin),
      startDate: startDate == null ? null : new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth(), new Date(startDate).getDate()).getTime(),
      endDate: endDate == null ? null : new Date(new Date(endDate).getFullYear(), new Date(endDate).getMonth(), new Date(endDate).getDate()).getTime(),
      rule: rule || 'fixed',
      countUnlimited: !!countUnlimited,
      createdAt: now(),
    }
    state.checkins.push(c)
    scheduleSave()
    return c
  }

  function updateCheckin(id, p) {
    const c = state.checkins.find((x) => x.id === id)
    if (!c) return null
    patch(c, p, CHECKIN_PATCH_KEYS)
    if ('fixedDurationMin' in p) c.fixedDurationMin = p.fixedDurationMin == null ? null : Number(p.fixedDurationMin)
    if ('rule' in p) c.rule = p.rule === 'count' ? 'count' : 'fixed'
    if ('countUnlimited' in p) c.countUnlimited = !!p.countUnlimited
    scheduleSave()
    return c
  }

  function deleteCheckin(id) {
    state.checkins = state.checkins.filter((c) => c.id !== id)
    state.checkinRecords = state.checkinRecords.filter((r) => r.checkinId !== id)
    scheduleSave()
  }

  function addCheckinRecord(checkinId, { count = 1, durationMin = 0, at = null, note = '' } = {}) {
    const r = {
      id: uid(),
      checkinId,
      count: Number(count) || 1,
      durationMin: Number(durationMin) || 0,
      at: at == null ? now() : at,
      note: String(note || '').trim(),
    }
    state.checkinRecords.push(r)
    scheduleSave()
    return r
  }

  function deleteCheckinRecord(id) {
    state.checkinRecords = state.checkinRecords.filter((r) => r.id !== id)
    scheduleSave()
  }

  // ---------- 标签 ----------
  function addTag({ name, color }) {
    const tag = { id: uid(), name, color: color || '#64748B' }
    state.tags.push(tag)
    scheduleSave()
    return tag
  }

  function updateTag(id, p) {
    const tag = state.tags.find((x) => x.id === id)
    if (!tag) return null
    patch(tag, p, TAG_PATCH_KEYS)
    scheduleSave()
    return tag
  }

  function deleteTag(id) {
    state.tags = state.tags.filter((t) => t.id !== id)
    const drop = (arr) => {
      for (const item of arr) {
        if (Array.isArray(item.tagIds)) item.tagIds = item.tagIds.filter((x) => x !== id)
      }
    }
    drop(state.todos)
    drop(state.projects)
    drop(state.projectSubTasks)
    scheduleSave()
  }

  // ---------- 专注 ----------
  function openFocus({ mode = null, targetType = 'none', targetId = null } = {}) {
    focusState.visible = true
    if (focusState.phase === 'idle' || focusState.phase === 'break') {
      if (mode) focusState.mode = mode
      focusState.targetType = targetType || 'none'
      focusState.targetId = targetId || null
    }
  }

  function setFocusTarget(targetType, targetId) {
    if (focusState.phase !== 'idle' && focusState.phase !== 'break') return
    focusState.targetType = targetType || 'none'
    focusState.targetId = targetId || null
  }

  function setFocusMode(mode) {
    if (focusState.phase !== 'idle' && focusState.phase !== 'break') return
    if (mode === 'pomodoro' || mode === 'free') focusState.mode = mode
  }

  function closeFocus() {
    focusState.visible = false
  }

  function focusPlanMs() {
    return state.settings.pomodoroFocusMin * 60000
  }

  function focusBreakMs() {
    return state.settings.pomodoroBreakMin * 60000
  }

  function focusElapsedMs(nowTs) {
    let e = focusState.accumMs
    if (focusState.phase === 'run') e += nowTs - focusState.runStartTs
    return e
  }

  function startFocusRun({ mode = null, targetType = null, targetId = null } = {}) {
    if (focusState.phase === 'run' || focusState.phase === 'pause') return
    if (mode) focusState.mode = mode
    if (targetType) focusState.targetType = targetType
    if (targetId !== undefined && targetId !== null) focusState.targetId = targetId
    focusState.runStartTs = now()
    focusState.accumMs = 0
    focusState.phase = 'run'
  }

  function pauseFocusRun() {
    if (focusState.phase !== 'run') return
    focusState.accumMs += now() - focusState.runStartTs
    focusState.phase = 'pause'
  }

  function resumeFocusRun() {
    if (focusState.phase !== 'pause') return
    focusState.runStartTs = now()
    focusState.phase = 'run'
  }

  function addSession({ mode, targetType = 'none', targetId = null, startAt, endAt, durationMin = 0, plannedMinutes = null, status = 'completed' } = {}) {
    const s = {
      id: uid(),
      mode,
      targetType: targetType || 'none',
      targetId: targetId || null,
      startAt,
      endAt,
      durationMin,
      plannedMinutes,
      status,
    }
    state.sessions.push(s)
    scheduleSave()
    return s
  }

  function endFocusRun({ auto = false } = {}, at = null) {
    const t = at == null ? now() : at
    const mode = focusState.mode
    const targetType = focusState.targetType
    const targetId = focusState.targetId
    const netMs = focusElapsedMs(t)
    if (netMs >= 60000) {
      const startAt = focusState.runStartTs || t
      const durationMin = auto ? state.settings.pomodoroFocusMin : Math.max(1, Math.round(netMs / 60000))
      addSession({
        mode,
        targetType,
        targetId,
        startAt,
        endAt: t,
        durationMin,
        plannedMinutes: mode === 'pomodoro' ? state.settings.pomodoroFocusMin : null,
      })
      // 打卡项目专注：完成一轮番茄自动记为一次打卡（时长型计入 minutes）
      if (auto && targetType === 'checkin' && targetId && state.checkins.some((c) => c.id === targetId)) {
        addCheckinRecord(targetId, { count: 1, durationMin, at: t, note: '专注完成' })
      }
    }
    focusState.accumMs = 0
    focusState.runStartTs = 0
    if (auto) {
      focusState.phase = 'break'
      focusState.breakStartTs = t
    } else {
      focusState.phase = 'idle'
    }
  }

  function focusTick(at = null) {
    const t = at == null ? now() : at
    if (focusState.phase === 'run' && focusState.mode === 'pomodoro' && focusElapsedMs(t) >= focusPlanMs()) {
      endFocusRun({ auto: true }, t)
    }
    if (focusState.phase === 'break' && t - focusState.breakStartTs >= focusBreakMs()) {
      focusState.phase = 'idle'
    }
  }

  function breakRemainMs(at = null) {
    const t = at == null ? now() : at
    if (focusState.phase !== 'break') return 0
    return Math.max(0, focusBreakMs() - (t - focusState.breakStartTs))
  }

  function skipBreak() {
    if (focusState.phase === 'break') focusState.phase = 'idle'
  }

  // ---------- 未来蓝图 ----------
  // 双向引用重建：蓝图的 related 与 todo/project 的 blueprintIds 保持一致
  function rebuildBlueprintRefs() {
    for (const t of state.todos) {
      if (Array.isArray(t.blueprintIds)) t.blueprintIds = []
    }
    for (const p of state.projects) {
      if (Array.isArray(p.blueprintIds)) p.blueprintIds = []
    }
    for (const b of state.blueprints) {
      for (const r of b.related || []) {
        const pool = r.type === 'project' ? state.projects : state.todos
        const obj = pool.find((x) => x.id === r.id)
        if (obj) {
          if (!Array.isArray(obj.blueprintIds)) obj.blueprintIds = []
          if (!obj.blueprintIds.includes(b.id)) obj.blueprintIds.push(b.id)
        }
      }
    }
  }

  function addBlueprint({ title, goalDateTs = null, goalStartTs = null, goalEndTs = null, goalText = '', dimension = '', desc = '', status = 'idea', notes = '', level = 'small' } = {}) {
    const b = {
      id: uid(),
      title,
      goalDateTs: null,
      goalStartTs: goalStartTs || null,
      goalEndTs: goalEndTs != null ? goalEndTs : goalDateTs != null ? goalDateTs : null,
      goalText: goalText || '',
      dimension: dimension || '',
      desc: desc || '',
      status: status || 'idea',
      notes: notes || '',
      level: level || 'small',
      related: [],
      createdAt: now(),
    }
    state.blueprints.push(b)
    scheduleSave()
    return b
  }

  function updateBlueprint(id, p) {
    const b = state.blueprints.find((x) => x.id === id)
    if (!b) return null
    patch(b, p, BLUEPRINT_PATCH_KEYS)
    scheduleSave()
    return b
  }

  function deleteBlueprint(id) {
    state.blueprints = state.blueprints.filter((b) => b.id !== id)
    rebuildBlueprintRefs()
    scheduleSave()
  }

  // 设置关联（全量替换 + 双向同步）；同一条目可被多个蓝图引用
  function syncRelated(blueprintId, related) {
    const b = state.blueprints.find((x) => x.id === blueprintId)
    if (!b) return
    b.related = (related || []).map((r) => ({ type: r.type, id: r.id }))
    rebuildBlueprintRefs()
    scheduleSave()
  }

  function addBlueprintDimension(name) {
    const dims = state.settings.blueprintDims || []
    if (!name.trim()) return null
    if (dims.some((d) => d.name === name.trim())) return null
    const d = { id: uid(), name: name.trim() }
    state.settings.blueprintDims = [...dims, d]
    scheduleSave()
    return d
  }

  function removeBlueprintDimension(dimId) {
    const affected = state.blueprints.filter((b) => b.dimension === dimId)
    for (const b of affected) b.dimension = ''
    state.settings.blueprintDims = (state.settings.blueprintDims || []).filter((d) => d.id !== dimId)
    scheduleSave()
  }

  function breakdownProject(bpId) {
    const b = state.blueprints.find((x) => x.id === bpId)
    if (!b) return null
    const p = addProject({ name: b.title || '未命名蓝图', desc: b.desc || '', type: '目标', category: 'plan' })
    b.related = [...(b.related || []), { type: 'project', id: p.id }]
    rebuildBlueprintRefs()
    scheduleSave()
    return p
  }

  function breakdownTodo(bpId) {
    const b = state.blueprints.find((x) => x.id === bpId)
    if (!b) return null
    const t = addTodo({ title: b.title || '未命名蓝图', note: b.desc || '', timeType: 'none' })
    b.related = [...(b.related || []), { type: 'todo', id: t.id }]
    rebuildBlueprintRefs()
    scheduleSave()
    return t
  }

  // ---------- 关系 ----------
  function addRelation({ name, gender = 'other', age = null, birthYear = null, birthMonth = null, birthDay = null, place = '', affinity = 3, note = '' } = {}) {
    const r = {
      id: uid(),
      name,
      gender,
      age: age != null && age !== '' ? Number(age) : null,
      birthYear: birthYear ? Number(birthYear) : null,
      birthMonth: birthMonth ? Number(birthMonth) : null,
      birthDay: birthDay ? Number(birthDay) : null,
      place: place || '',
      affinity: clampAffinity(affinity),
      note: note || '',
      createdAt: now(),
    }
    state.relations.push(r)
    scheduleSave()
    return r
  }

  function updateRelation(id, p) {
    const r = state.relations.find((x) => x.id === id)
    if (!r) return null
    patch(r, p, RELATION_PATCH_KEYS)
    if ('affinity' in p) r.affinity = clampAffinity(p.affinity)
    scheduleSave()
    return r
  }

  function deleteRelation(id) {
    state.relations = state.relations.filter((r) => r.id !== id)
    scheduleSave()
  }

  // ---------- 目标（月度 / 季度） ----------
  function sameGoalPeriod(g, year, scope, index) {
    return g.year === year && g.scope === scope && g.index === index
  }

  function addGoal({ year, scope = 'month', index = 0, name, desc = '' } = {}) {
    const g = {
      id: uid(),
      year,
      scope,
      index,
      name,
      desc: desc || '',
      done: false,
      order: state.goals.filter((x) => sameGoalPeriod(x, year, scope, index)).length,
      createdAt: now(),
    }
    state.goals.push(g)
    scheduleSave()
    return g
  }

  function updateGoal(id, p) {
    const g = state.goals.find((x) => x.id === id)
    if (!g) return null
    patch(g, p, GOAL_PATCH_KEYS)
    scheduleSave()
    return g
  }

  function deleteGoal(id) {
    state.goals = state.goals.filter((g) => g.id !== id)
    // 同步清理复盘里的关联引用（不影响其它数据）
    for (const r of state.reviews) {
      if (Array.isArray(r.goals) && r.goals.includes(id)) r.goals = r.goals.filter((x) => x !== id)
    }
    scheduleSave()
  }

  function toggleGoalDone(id, done) {
    const g = state.goals.find((x) => x.id === id)
    if (!g) return
    g.done = done != null ? done : !g.done
    scheduleSave()
  }

  function setGoalNote(year, scope, index, text) {
    const k = `${scope}-${year}-${index}`
    if (text && text.trim()) state.goalNotes[k] = text
    else delete state.goalNotes[k]
    scheduleSave()
  }

  // ---------- 复盘 ----------
  function addReview({ type = 'day', periodDate = null, fields = {}, goals = [] } = {}) {
    const r = {
      id: uid(),
      type,
      periodDate: periodDate == null ? now() : periodDate,
      fields: {
        plan: fields.plan || '',
        events: fields.events || '',
        problems: fields.problems || '',
        improvement: fields.improvement || '',
        summary: fields.summary || '',
      },
      goals: Array.isArray(goals) ? [...goals] : [],
      createdAt: now(),
      updatedAt: now(),
    }
    state.reviews.push(r)
    scheduleSave()
    return r
  }

  function updateReview(id, p) {
    const r = state.reviews.find((x) => x.id === id)
    if (!r) return null
    const { fields: f, ...rest } = p
    patch(r, rest, REVIEW_PATCH_KEYS)
    if (f && typeof f === 'object') r.fields = { ...r.fields, ...f }
    r.updatedAt = now()
    scheduleSave()
    return r
  }

  function deleteReview(id) {
    state.reviews = state.reviews.filter((r) => r.id !== id)
    scheduleSave()
  }

  // ---------- 设置 ----------
  function applyThemeAll() {
    applyTheme(state.settings.theme, { mode: state.settings.mode || 'light', style: state.settings.style || 'glass' })
  }

  function setSetting(key, value) {
    if (!SETTINGS_KEYS.includes(key)) return
    state.settings[key] = value
    if (key === 'theme' || key === 'mode' || key === 'style') applyThemeAll()
    scheduleSave()
  }

  // ---------- 持久化 / 迁移 ----------
  async function init() {
    const data = await dbImpl.load()
    if (data) {
      Object.assign(state, normalizeData(data))
    } else {
      await persistNow()
    }
    if (migrateLegacySubTasks()) await persistNow()
    applyThemeAll()
    state.ready = true
  }

  async function reload() {
    const data = await dbImpl.load()
    if (data) Object.assign(state, normalizeData(data))
    if (migrateLegacySubTasks()) await persistNow()
    applyThemeAll()
  }

  function exportData() {
    return JSON.parse(JSON.stringify({ ...state, version: 1 }))
  }

  const DATA_ARRS = ['tags', 'todos', 'projects', 'projectSubTasks', 'checkins', 'checkinRecords', 'sessions', 'reviews', 'blueprints', 'relations', 'goals']

  function assertValidData(d) {
    if (!d || typeof d !== 'object') throw new Error('文件内容不是有效的数据对象')
    if (!Array.isArray(d.todos)) throw new Error('备份文件中没有找到任务数据（todos）')
  }

  async function importData(raw) {
    assertValidData(raw)
    // 宽容导入：缺失的数据块置为空并记录提示，其余数据照常恢复
    const missing = DATA_ARRS.filter((k) => !Array.isArray(raw[k]))
    const d = normalizeData(raw)
    await dbImpl.backupCurrent()
    Object.assign(state, d)
    if (migrateLegacySubTasks()) {
      /* 迁移旧备份中的项目子任务为普通待办 */
    }
    rebuildBlueprintRefs()
    applyThemeAll()
    await persistNow()
    return missing
  }

  async function clearAll() {
    await dbImpl.backupCurrent()
    Object.assign(state, defaultState())
    applyThemeAll()
    await persistNow()
  }

  function _replace(data) {
    Object.assign(state, normalizeData(data))
  }

  return {
    state,
    focusState,
    uid,
    persistNow,
    scheduleSave,
    addTodo,
    updateTodo,
    deleteTodo,
    duplicateTodo,
    moveTodo,
    toggleTodo,
    addProject,
    updateProject,
    deleteProject,
    archiveProject,
    addSubTask,
    updateSubTask,
    deleteSubTask,
    cycleSubTaskStatus,
    setSubTaskOnHome,
    migrateLegacySubTasks,
    addCheckin,
    updateCheckin,
    deleteCheckin,
    addCheckinRecord,
    deleteCheckinRecord,
    addTag,
    updateTag,
    deleteTag,
    openFocus,
    closeFocus,
    setFocusTarget,
    setFocusMode,
    startFocusRun,
    pauseFocusRun,
    resumeFocusRun,
    endFocusRun,
    focusTick,
    skipBreak,
    breakRemainMs,
    focusElapsedMs,
    addSession,
    addReview,
    updateReview,
    deleteReview,
    addBlueprint,
    updateBlueprint,
    deleteBlueprint,
    syncRelated,
    addBlueprintDimension,
    removeBlueprintDimension,
    breakdownProject,
    breakdownTodo,
    addRelation,
    updateRelation,
    deleteRelation,
    addGoal,
    updateGoal,
    deleteGoal,
    toggleGoalDone,
    setGoalNote,
    setSetting,
    init,
    reload,
    exportData,
    importData,
    clearAll,
    _replace,
  }
}

export const store = createStore()
