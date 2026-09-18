import { DAY_MS, startOfDayTs, endOfDayTs, isSameDayTs, fmtDate } from './utils/date.js'

// ---------- 待办 ----------

export function todoOverdue(t, nowTs = Date.now()) {
  if (t.completed) return false
  // 推迟（宽限）期内不算逾期：到 snoozeUntil 仍未完成则恢复逾期判定
  if (t.snoozeUntil != null && nowTs < t.snoozeUntil) return false
  switch (t.timeType) {
    case 'date':
      return t.startAt != null && endOfDayTs(t.startAt) < nowTs
    case 'datetime':
      return t.startAt != null && t.startAt < nowTs
    case 'range':
      return t.endAt != null && t.endAt < nowTs
    default:
      return false
  }
}

export function todoActiveOnDay(t, dayTs) {
  switch (t.timeType) {
    case 'date':
      return t.startAt != null && isSameDayTs(t.startAt, dayTs)
    case 'datetime':
      return t.startAt != null && isSameDayTs(t.startAt, dayTs)
    case 'range':
      return t.startAt != null && t.endAt != null && t.startAt < dayTs + DAY_MS && t.endAt >= dayTs
    default:
      return false
  }
}

// 任务的时间安排与 [fromTs, toTsExclusive) 有交集（用于周/月视图过滤）
export function todoActiveInRange(t, fromTs, toTsExclusive) {
  if (t.startAt == null) return false
  switch (t.timeType) {
    case 'date':
    case 'datetime':
      return t.startAt >= fromTs && t.startAt < toTsExclusive
    case 'range':
      return t.endAt != null && t.startAt < toTsExclusive && t.endAt >= fromTs
    default:
      return false
  }
}

export function selectDueTodos(todos, mode, nowTs = Date.now()) {
  if (mode === 'overdue') return todos.filter((t) => !t.completed && todoOverdue(t, nowTs))
  if (mode === 'today') {
    const d = startOfDayTs(nowTs)
    return todos.filter((t) => todoActiveOnDay(t, d))
  }
  return [...todos]
}

export function todoRoots(todos) {
  return todos.filter((t) => !t.parentId).sort((a, b) => (a.order || 0) - (b.order || 0))
}

export const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2, none: 3 }

// 排序模式：custom(手拖顺序) / time(时间，无时间最后) / priority(高→中→低→无)
export function compareTasksByMode(a, b, mode) {
  if (mode !== 'time' && mode !== 'priority') return (a.order || 0) - (b.order || 0)
  const da = a.completed ? 1 : 0
  const db = b.completed ? 1 : 0
  if (da !== db) return da - db
  const at = a.startAt == null ? Infinity : a.startAt
  const bt = b.startAt == null ? Infinity : b.startAt
  if (mode === 'priority') {
    const diff = PRIORITY_WEIGHT[a.priority || 'none'] - PRIORITY_WEIGHT[b.priority || 'none']
    if (diff) return diff
    if (at !== bt) return at - bt
    return (a.order || 0) - (b.order || 0)
  }
  if (at !== bt) return at - bt
  return (a.order || 0) - (b.order || 0)
}

export function todoChildren(todos, parentId) {
  return todos.filter((t) => t.parentId === parentId).sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function subtreeStats(todos, id) {
  let total = 0
  let done = 0
  const stack = [id]
  while (stack.length) {
    const pid = stack.pop()
    for (const t of todos) {
      if (t.parentId === pid) {
        total += 1
        if (t.completed) done += 1
        stack.push(t.id)
      }
    }
  }
  return { total, done, allDone: total > 0 && done === total }
}

export function subtreeIds(todos, id) {
  const out = [id]
  const stack = [id]
  while (stack.length) {
    const pid = stack.pop()
    for (const t of todos) {
      if (t.parentId === pid) {
        out.push(t.id)
        stack.push(t.id)
      }
    }
  }
  return out
}

// 返回树中“自身命中或含命中后代”的节点集合（用于树形过滤渲染）
export function visibleTreeSet(todos, hitIds) {
  const childrenOf = new Map()
  for (const t of todos) {
    if (t.parentId) {
      if (!childrenOf.has(t.parentId)) childrenOf.set(t.parentId, [])
      childrenOf.get(t.parentId).push(t)
    }
  }
  const visible = new Set()
  const containsHit = (id) => {
    let any = hitIds.has(id)
    for (const c of childrenOf.get(id) || []) {
      if (containsHit(c.id)) any = true
    }
    if (any) visible.add(id)
    return any
  }
  for (const t of todos) {
    if (!t.parentId) containsHit(t.id)
  }
  return visible
}

export function todayCompletedCount(state, nowTs = Date.now()) {
  const d = startOfDayTs(nowTs)
  return state.todos.filter((t) => t.completed && t.completedAt != null && t.completedAt >= d && t.completedAt < d + DAY_MS).length
}

export function dueSoonItems(state, nowTs = Date.now(), windowMs = 48 * 3600000) {
  const out = []
  for (const t of state.todos) {
    if (t.completed) continue
    if ((t.timeType === 'datetime' || t.timeType === 'range') && t.startAt != null && t.startAt >= nowTs && t.startAt <= nowTs + windowMs) {
      out.push({ kind: 'todo', at: t.startAt, title: t.title, id: t.id, item: t })
    }
  }
  for (const p of state.projects) {
    if (!p.completed && p.deadline != null && p.deadline >= nowTs && p.deadline <= nowTs + windowMs) {
      out.push({ kind: 'project', at: p.deadline, title: p.name, id: p.id, item: p })
    }
  }
  return out.sort((a, b) => a.at - b.at)
}

// ---------- 项目 ----------

export function projectSubTasks(state, projectId) {
  // 统一模型：项目任务 = 挂在项目下的普通待办（项目内顶层任务）
  return state.todos.filter((t) => t.projectId === projectId && !t.parentId).sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function projectTodos(state, projectId) {
  return state.todos.filter((t) => t.projectId === projectId)
}

export function projectStats(state, projectId) {
  const proj = projectById(state, projectId)
  const projectTodosList = projectTodos(state, projectId)
  const doneList = projectTodosList.filter((t) => t.completed)
  const done = doneList.length
  const total = projectTodosList.length
  const mode = proj && proj.progressMode === 'hours' ? 'hours' : 'count'
  if (mode === 'hours') {
    const totalWork = Math.max(0, Number(proj.totalWorkload) || 0)
    const doneWork = doneList.reduce((a, t) => a + (Number(t.estimatedHours) || 0), 0)
    const pct =
      totalWork > 0
        ? Math.min(100, Math.round((doneWork / totalWork) * 100))
        : total
          ? Math.min(100, Math.round((done / total) * 100))
          : 0
    const allDone = totalWork > 0 ? doneWork >= totalWork : total > 0 && done === total
    return { total, done, pct, allDone, mode, doneWork, totalWork, unit: proj.workloadUnit || '小时', planTotal: 0, denom: totalWork }
  }
  // 按任务数量统计：分母 = 用户预设的任务总量；未设置时回退为当前已建任务数
  const planTotal = Math.max(0, Number(proj && proj.totalWorkload) || 0)
  const denom = planTotal > 0 ? planTotal : total
  const pct = denom ? Math.min(100, Math.round((done / denom) * 100)) : 0
  const allDone = denom > 0 && done >= denom
  return { total, done, pct, allDone, mode, doneWork: 0, totalWork: 0, unit: '', planTotal, denom }
}

export function fmtWork(n) {
  const v = Number(n) || 0
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

export function projectProgressText(state, projectId) {
  const st = projectStats(state, projectId)
  if (st.mode === 'hours') return `${fmtWork(st.doneWork)}/${fmtWork(st.totalWork)} ${st.unit}`
  if (st.planTotal > 0) return `${st.done}/${st.planTotal} 任务`
  return `${st.done}/${st.total} 子任务`
}

export function activeProjects(state) {
  return state.projects.filter((p) => !p.completed).sort((a, b) => (a.order || 0) - (b.order || 0))
}

export function archivedProjects(state) {
  return state.projects.filter((p) => p.completed).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
}

export function onHomeSubTasks(state) {
  // 兼容保留：项目任务可直接出现在首页；普通任务无 projectId 不计入
  const active = new Set(activeProjects(state).map((p) => p.id))
  return state.todos.filter((t) => t.projectId && t.onHome && !t.completed && active.has(t.projectId)).sort((a, b) => (a.startAt || 0) - (b.startAt || 0))
}

export function subTaskOverdue(s, nowTs = Date.now()) {
  return todoOverdue(s, nowTs)
}

export function projectOverdue(p, nowTs = Date.now()) {
  if (p.completed || p.deadline == null) return false
  return endOfDayTs(p.deadline) < nowTs
}

export function projectById(state, id) {
  return state.projects.find((p) => p.id === id) || null
}

// ---------- 专注 ----------

export function sessionsOnDay(sessions, dayTs) {
  const s = startOfDayTs(dayTs)
  return sessions.filter((x) => x.startAt != null && x.startAt >= s && x.startAt < s + DAY_MS)
}

export function todayFocusStats(sessions, nowTs = Date.now()) {
  const list = sessionsOnDay(sessions, nowTs)
  return {
    count: list.length,
    minutes: list.reduce((a, s) => a + (s.durationMin || 0), 0),
  }
}

export function sessionsOfTarget(sessions, targetType, targetId) {
  return sessions
    .filter((s) => s.targetType === targetType && s.targetId === targetId)
    .sort((a, b) => b.startAt - a.startAt)
}

// ---------- 打卡 ----------

export function checkinActive(c, nowTs = Date.now()) {
  const d = startOfDayTs(nowTs)
  if (c.startDate != null && d < startOfDayTs(c.startDate)) return false
  if (c.endDate != null && d > endOfDayTs(c.endDate)) return false
  return true
}

export function indexCheckinRecords(records, checkinId) {
  const map = {}
  for (const r of records) {
    if (r.checkinId !== checkinId) continue
    const k = fmtDate(r.at)
    if (!map[k]) map[k] = []
    map[k].push(r)
  }
  return map
}

export function dayRecordStats(map, dayTs) {
  const rs = map[fmtDate(dayTs)] || []
  let counts = 0
  let totalDuration = 0
  for (const r of rs) {
    counts += r.count || 0
    totalDuration += r.durationMin || 0
  }
  return { counts, totalDuration, records: rs.length }
}

export function checkinDayMet(c, map, dayTs) {
  const s = dayRecordStats(map, dayTs)
  // 时长型：次数与时长达标（兼容旧数据 rule 缺省）
  if (c.fixedDurationMin != null) {
    if (s.counts < c.dailyTargetCount) return false
    if (s.totalDuration < c.dailyTargetCount * c.fixedDurationMin) return false
    return true
  }
  // 计数模式
  if (c.rule === 'count') {
    if (c.countUnlimited) return s.counts > 0
    return s.counts >= (c.dailyTargetCount || 1)
  }
  return s.counts >= (c.dailyTargetCount || 1)
}

export function checkinTodayProgressText(c, stat) {
  if (c.fixedDurationMin != null) {
    return `${stat.totalDuration}/${c.dailyTargetCount * c.fixedDurationMin} 分钟`
  }
  if (c.rule === 'count' && c.countUnlimited) return `${stat.counts} ${c.unit}`
  return `${stat.counts}/${c.dailyTargetCount} ${c.unit}`
}

export function checkinStreak(c, map, nowTs = Date.now()) {
  let streak = 0
  let day = startOfDayTs(nowTs)
  if (!checkinDayMet(c, map, day)) day -= DAY_MS
  while (checkinDayMet(c, map, day)) {
    streak += 1
    day -= DAY_MS
  }
  return streak
}

export function chartDailySeries(map, fromDayTs, dayCount) {
  const arr = []
  for (let i = dayCount - 1; i >= 0; i -= 1) {
    const day = fromDayTs - i * DAY_MS
    const st = dayRecordStats(map, day)
    arr.push({ ts: day, counts: st.counts, duration: st.totalDuration, records: st.records })
  }
  return arr
}

export function checkinStatsRange(c, map, fromTs, toTsExclusive) {
  let totalDays = 0
  let metDays = 0
  let totalCounts = 0
  let totalDuration = 0
  let day = startOfDayTs(fromTs)
  const end = startOfDayTs(toTsExclusive - 1)
  while (day <= end) {
    const st = dayRecordStats(map, day)
    totalDays += 1
    totalCounts += st.counts
    totalDuration += st.totalDuration
    if (checkinDayMet(c, map, day)) metDays += 1
    day += DAY_MS
  }
  return { totalDays, metDays, totalCounts, totalDuration, metRate: totalDays ? Math.round((metDays / totalDays) * 100) : 0 }
}

export function checkinTodayList(state, nowTs = Date.now()) {
  return state.checkins.map((c) => {
    const map = indexCheckinRecords(state.checkinRecords, c.id)
    const day = startOfDayTs(nowTs)
    const met = checkinDayMet(c, map, day)
    const st = dayRecordStats(map, day)
    return {
      checkin: c,
      stat: st,
      met,
      streak: checkinStreak(c, map, nowTs),
      active: checkinActive(c, nowTs),
    }
  })
}

export function todayMetCount(state, nowTs = Date.now()) {
  const day = startOfDayTs(nowTs)
  let met = 0
  for (const c of state.checkins) {
    const map = indexCheckinRecords(state.checkinRecords, c.id)
    if (checkinDayMet(c, map, day)) met += 1
  }
  return met
}

// ---------- 日历聚合 ----------

export function calendarItems(state, startTs, endTsExclusive) {
  const items = []
  for (const t of state.todos) {
    if (t.timeType === 'date') {
      if (t.startAt != null && t.startAt >= startTs && t.startAt < endTsExclusive) {
        items.push({ kind: 'allDay', id: t.id, ts: t.startAt, ref: 'todo', todo: t })
      }
    } else if (t.timeType === 'datetime') {
      if (t.startAt != null && t.startAt >= startTs && t.startAt < endTsExclusive) {
        items.push({ kind: 'point', id: t.id, ts: t.startAt, ref: 'todo', todo: t })
      }
    } else if (t.timeType === 'range') {
      if (t.startAt != null && t.endAt != null) {
        const s = Math.max(t.startAt, startTs)
        const e = Math.min(t.endAt, endTsExclusive)
        if (s < e) {
          items.push({ kind: 'range', id: t.id, ts: s, startTs: s, endTs: e, ref: 'todo', todo: t })
        }
      }
    }
  }
  for (const se of state.sessions) {
    if (se.startAt != null && se.startAt >= startTs && se.startAt < endTsExclusive) {
      items.push({ kind: 'session', id: se.id, ts: se.startAt, endTs: se.endAt || se.startAt, ref: 'session', session: se })
    }
  }
  // 未来蓝图：默认不在日历显示；开关开启后仅做提示展示（非待办）
  if (state.settings.showBlueprintsOnCalendar) {
    for (const b of state.blueprints) {
      const endTs = b.goalEndTs != null ? b.goalEndTs : b.goalDateTs
      if (endTs == null || b.status === 'paused' || b.status === 'done') continue
      items.push({ kind: 'allDay', ref: 'blueprint', id: b.id, ts: startOfDayTs(endTs), blueprint: b })
    }
  }
  // 附带项目名，便于日历上展示归属
  for (const it of items) {
    if (it.todo && it.todo.projectId) {
      const p = state.projects.find((x) => x.id === it.todo.projectId)
      if (p) it.pName = p.name
    }
  }
  return items.sort((a, b) => a.ts - b.ts)
}

// ---------- 标签 ----------

export function tagCounts(state) {
  const c = {}
  for (const tg of state.tags) c[tg.id] = { todo: 0, project: 0, sub: 0 }
  const bump = (arr, key) => {
    for (const it of arr) {
      for (const id of it.tagIds || []) if (c[id]) c[id][key] += 1
    }
  }
  bump(state.todos.filter((t) => !t.projectId), 'todo')
  bump(state.projects, 'project')
  bump(state.todos.filter((t) => t.projectId), 'sub')
  return c
}

export function tagEntities(state, tagId) {
  const has = (it) => (it.tagIds || []).includes(tagId)
  return {
    todos: state.todos.filter((t) => has(t) && !t.projectId),
    projects: state.projects.filter(has),
    subTasks: state.todos.filter((t) => has(t) && !!t.projectId),
  }
}

export function tagOf(state, tagId) {
  return state.tags.find((t) => t.id === tagId) || null
}

export function tagsOf(state, tagIds) {
  const map = {}
  for (const t of state.tags) map[t.id] = t
  return (tagIds || []).map((id) => map[id]).filter(Boolean)
}

// ---------- 复盘 ----------

export function reviewsFor(state, type) {
  return state.reviews
    .filter((r) => r.type === type)
    .sort((a, b) => (b.periodDate || 0) - (a.periodDate || 0))
}

export function reviewExistsForPeriod(state, type, anchorTs) {
  return state.reviews.some((r) => r.type === type && r.periodDate === anchorTs)
}

export function completedTodosInRange(state, startTs, endTsExclusive) {
  return state.todos
    .filter((t) => t.completed && t.completedAt != null && t.completedAt >= startTs && t.completedAt < endTsExclusive)
    .sort((a, b) => b.completedAt - a.completedAt)
}

export function archivedProjectsInRange(state, startTs, endTsExclusive) {
  return state.projects
    .filter((p) => p.completed && p.completedAt != null && p.completedAt >= startTs && p.completedAt < endTsExclusive)
    .sort((a, b) => b.completedAt - a.completedAt)
}
