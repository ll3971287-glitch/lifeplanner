import { describe, it, expect, beforeEach } from 'vitest'
import { makeStore, DAY } from './helpers.js'
import * as sel from '../src/selectors.js'
import { parseDateStr, parseDateTimeStr, fmtDate, startOfDayTs, startOfWeekTs, DAY_MS } from '../src/utils/date.js'

function seedTodo(over = {}) {
  return {
    id: over.id || 't' + Math.random().toString(36).slice(2, 8),
    title: over.title || '任务',
    note: '',
    timeType: over.timeType || 'none',
    startAt: over.startAt ?? null,
    endAt: over.endAt ?? null,
    completed: over.completed ?? false,
    completedAt: over.completedAt ?? null,
    projectId: over.projectId ?? null,
    estimatedHours: over.estimatedHours ?? 0,
    onHome: over.onHome ?? false,
    tagIds: over.tagIds || [],
    parentId: over.parentId ?? null,
    order: 0,
    createdAt: 0,
  }
}

describe('待办派生', () => {
  let store
  const NOW = parseDateTimeStr('2026-09-02 12:00:00')
  beforeEach(() => {
    ;({ store } = makeStore(NOW))
  })

  it('todoOverdue：date 当天结束前不过期，次日过期', () => {
    const today = seedTodo({ timeType: 'date', startAt: parseDateStr('2026-09-02') })
    const yesterday = seedTodo({ timeType: 'date', startAt: parseDateStr('2026-09-01') })
    const done = seedTodo({ timeType: 'date', startAt: parseDateStr('2026-09-01'), completed: true, completedAt: 1 })
    expect(sel.todoOverdue(today, NOW)).toBe(false)
    expect(sel.todoOverdue(yesterday, NOW)).toBe(true)
    expect(sel.todoOverdue(done, NOW)).toBe(false)
  })

  it('todoOverdue：datetime 到点即过期；range 结束后过期', () => {
    const dt = seedTodo({ timeType: 'datetime', startAt: parseDateTimeStr('2026-09-02 10:00:00') })
    const dtFuture = seedTodo({ timeType: 'datetime', startAt: parseDateTimeStr('2026-09-02 14:00:00') })
    const rg = seedTodo({ timeType: 'range', startAt: parseDateTimeStr('2026-09-01 09:00:00'), endAt: parseDateTimeStr('2026-09-01 18:00:00') })
    const rgRunning = seedTodo({ timeType: 'range', startAt: parseDateTimeStr('2026-09-02 09:00:00'), endAt: parseDateTimeStr('2026-09-02 18:00:00') })
    expect(sel.todoOverdue(dt, NOW)).toBe(true)
    expect(sel.todoOverdue(dtFuture, NOW)).toBe(false)
    expect(sel.todoOverdue(rg, NOW)).toBe(true)
    expect(sel.todoOverdue(rgRunning, NOW)).toBe(false)
  })

  it('todoOverdue：跨天任务在结束日当天不算逾期（即使已过结束时刻）', () => {
    // 结束日=今天 09:00，当前 12:00：仍在结束日当天 → 正常
    const todayEnded = seedTodo({ timeType: 'range', startAt: parseDateTimeStr('2026-09-02 08:00:00'), endAt: parseDateTimeStr('2026-09-02 09:00:00') })
    // 结束日=昨天 18:00 → 超过结束日 → 逾期
    const yesterdayEnded = seedTodo({ timeType: 'range', startAt: parseDateTimeStr('2026-09-01 09:00:00'), endAt: parseDateTimeStr('2026-09-01 18:00:00') })
    // 覆盖到明天 → 正常
    const spanning = seedTodo({ timeType: 'range', startAt: parseDateTimeStr('2026-09-01 09:00:00'), endAt: parseDateTimeStr('2026-09-03 18:00:00') })
    expect(sel.todoOverdue(todayEnded, NOW)).toBe(false)
    expect(sel.todoOverdue(yesterdayEnded, NOW)).toBe(true)
    expect(sel.todoOverdue(spanning, NOW)).toBe(false)
  })

  it('todoActiveOnDay：date/datetime 命中当天；range 跨天命中', () => {
    const d = startOfDayTs(NOW)
    const dateTodo = seedTodo({ timeType: 'date', startAt: d })
    const dtTodo = seedTodo({ timeType: 'datetime', startAt: d + 9 * 3600000 })
    const rangeTodo = seedTodo({ timeType: 'range', startAt: d - DAY, endAt: d + DAY })
    const off = seedTodo({ timeType: 'date', startAt: d + 2 * DAY })
    expect(sel.todoActiveOnDay(dateTodo, d)).toBe(true)
    expect(sel.todoActiveOnDay(dtTodo, d)).toBe(true)
    expect(sel.todoActiveOnDay(rangeTodo, d)).toBe(true)
    expect(sel.todoActiveOnDay(off, d)).toBe(false)
  })

  it('todoActiveInRange 按时间范围过滤（周/月视图）', () => {
    const s = startOfWeekTs(NOW)
    const e = s + 7 * DAY_MS
    const inWeek = seedTodo({ id: 'w1', timeType: 'datetime', startAt: s + 2 * DAY_MS + 9 * 3600000 })
    const crossRange = seedTodo({ id: 'w2', timeType: 'range', startAt: s + 6 * DAY_MS, endAt: s + 8 * DAY_MS })
    const outside = seedTodo({ id: 'w3', timeType: 'date', startAt: s - DAY })
    expect(sel.todoActiveInRange(inWeek, s, e)).toBe(true)
    expect(sel.todoActiveInRange(crossRange, s, e)).toBe(true)
    expect(sel.todoActiveInRange(outside, s, e)).toBe(false)
  })

  it('selectDueTodos today/overdue 模式过滤正确', () => {
    const d = startOfDayTs(NOW)
    const today = seedTodo({ id: 'today1', title: '今天', timeType: 'datetime', startAt: d + 15 * 3600000 })
    const overdue = seedTodo({ id: 'od1', title: '逾期', timeType: 'datetime', startAt: d - DAY })
    const none = seedTodo({ id: 'none1', title: '无时间', timeType: 'none' })
    store._replace({ todos: [today, overdue, none] })
    const t = sel.selectDueTodos(store.state.todos, 'today', NOW)
    expect(t.map((x) => x.id)).toEqual(['today1'])
    const o = sel.selectDueTodos(store.state.todos, 'overdue', NOW)
    expect(o.map((x) => x.id)).toEqual(['od1'])
  })

  it('subtreeStats 统计全部后代', () => {
    const todos = [
      seedTodo({ id: 'r' }),
      seedTodo({ id: 'a', parentId: 'r' }),
      seedTodo({ id: 'b', parentId: 'r', completed: true }),
      seedTodo({ id: 'c', parentId: 'a' }),
      seedTodo({ id: 'c2', parentId: 'c' }),
    ]
    const st = sel.subtreeStats(todos, 'r')
    expect(st.total).toBe(4)
    expect(st.done).toBe(1)
    expect(st.allDone).toBe(false)
  })

  it('todayCompletedCount 只统计今天完成的', () => {
    const d = startOfDayTs(NOW)
    store._replace({
      todos: [
        seedTodo({ id: 'y1', completed: true, completedAt: d + 1000 }),
        seedTodo({ id: 'y2', completed: true, completedAt: d + 2000 }),
        seedTodo({ id: 'old', completed: true, completedAt: d - DAY }),
        seedTodo({ id: 'no', completed: false }),
      ],
    })
    expect(sel.todayCompletedCount(store.state, NOW)).toBe(2)
  })

  it('dueSoonItems 48h 窗口内任务与项目截止', () => {
    const d = startOfDayTs(NOW)
    store._replace({
      todos: [
        seedTodo({ id: 'soon', timeType: 'datetime', startAt: NOW + 3600000 }),
        seedTodo({ id: 'far', timeType: 'datetime', startAt: NOW + 50 * 3600000 }),
      ],
      projects: [{ id: 'p1', name: '项目', deadline: NOW + 2 * 3600000, completed: false }],
    })
    const items = sel.dueSoonItems(store.state, NOW)
    expect(items.map((x) => x.id).sort()).toEqual(['p1', 'soon'].sort())
  })
})

describe('项目派生', () => {
  let store
  const NOW = parseDateTimeStr('2026-09-02 12:00:00')
  beforeEach(() => {
    ;({ store } = makeStore(NOW))
  })

  it('projectStats 按完成任务数量统计（项目任务=普通待办）', () => {
    const p = { id: 'p1', name: 'P', completed: false, progressMode: 'count' }
    store._replace({
      projects: [p],
      todos: [
        seedTodo({ id: 's1', projectId: 'p1', completed: true, estimatedHours: 4 }),
        seedTodo({ id: 's2', projectId: 'p1', completed: false, estimatedHours: 6 }),
        seedTodo({ id: 's3', projectId: 'p1', completed: false, estimatedHours: 2 }),
      ],
    })
    const st = sel.projectStats(store.state, 'p1')
    expect(st.total).toBe(3)
    expect(st.done).toBe(1)
    expect(st.pct).toBe(33)
    expect(st.allDone).toBe(false)
    expect(st.mode).toBe('count')
  })

  it('projectStats 按累计时长统计：已完成任务时长 ÷ 总工作量', () => {
    const p = { id: 'p1', name: 'P', completed: false, progressMode: 'hours', totalWorkload: 10, workloadUnit: '小时' }
    store._replace({
      projects: [p],
      todos: [
        seedTodo({ id: 's1', projectId: 'p1', completed: true, estimatedHours: 4 }),
        seedTodo({ id: 's2', projectId: 'p1', completed: true, estimatedHours: 1 }),
        seedTodo({ id: 's3', projectId: 'p1', completed: false, estimatedHours: 5 }),
      ],
    })
    const st = sel.projectStats(store.state, 'p1')
    expect(st.mode).toBe('hours')
    expect(st.doneWork).toBe(5)
    expect(st.totalWork).toBe(10)
    expect(st.pct).toBe(50)
    expect(st.allDone).toBe(false)
    store.state.todos.find((x) => x.id === 's3').completed = true
    expect(sel.projectStats(store.state, 'p1').pct).toBe(100)
  })

  it('时长模式未设总工作量时回退为按数量统计', () => {
    const p = { id: 'p1', name: 'P', progressMode: 'hours', totalWorkload: 0 }
    store._replace({
      projects: [p],
      todos: [
        seedTodo({ id: 's1', projectId: 'p1', completed: true, estimatedHours: 2 }),
        seedTodo({ id: 's2', projectId: 'p1', completed: false, estimatedHours: 8 }),
      ],
    })
    expect(sel.projectStats(store.state, 'p1').pct).toBe(50)
  })

  it('projectProgressText 输出两种文案与单位', () => {
    store._replace({ projects: [{ id: 'p1', progressMode: 'count' }], todos: [seedTodo({ id: 's1', projectId: 'p1', completed: true }), seedTodo({ id: 's2', projectId: 'p1', completed: false })] })
    expect(sel.projectProgressText(store.state, 'p1')).toBe('1/2 子任务')
    store._replace({
      projects: [{ id: 'p1', progressMode: 'hours', totalWorkload: 10, workloadUnit: '小时' }],
      todos: [seedTodo({ id: 's1', projectId: 'p1', completed: true, estimatedHours: 2.5 }), seedTodo({ id: 's2', projectId: 'p1', completed: false, estimatedHours: 7.5 })],
    })
    expect(sel.projectProgressText(store.state, 'p1')).toBe('2.5/10 小时')
  })

  it('onHomeSubTasks 只含进行中项目里已开启且未完成的项目任务', () => {
    store._replace({
      projects: [
        { id: 'act', name: '进行中', completed: false },
        { id: 'done', name: '已归档', completed: true },
      ],
      todos: [
        seedTodo({ id: 'a', projectId: 'act', onHome: true, completed: false }),
        seedTodo({ id: 'b', projectId: 'act', onHome: true, completed: true }),
        seedTodo({ id: 'c', projectId: 'act', onHome: false, completed: false }),
        seedTodo({ id: 'd', projectId: 'done', onHome: true, completed: false }),
      ],
    })
    const list = sel.onHomeSubTasks(store.state)
    expect(list.map((x) => x.id)).toEqual(['a'])
  })

  it('subTaskOverdue 复用普通待办逾期判定', () => {
    expect(sel.subTaskOverdue({ timeType: 'datetime', startAt: NOW - 1, completed: false }, NOW)).toBe(true)
    expect(sel.subTaskOverdue({ timeType: 'datetime', startAt: NOW - 1, completed: true }, NOW)).toBe(false)
    expect(sel.subTaskOverdue({ timeType: 'none', startAt: null, completed: false }, NOW)).toBe(false)
  })
})

describe('专注派生', () => {
  const NOW = parseDateTimeStr('2026-09-02 12:00:00')

  it('todayFocusStats 与 sessionsOnDay 按天统计', () => {
    const sessions = [
      { id: 'a', startAt: NOW - 1000, durationMin: 25 },
      { id: 'b', startAt: NOW + 1000, durationMin: 30 },
      { id: 'c', startAt: NOW - DAY, durationMin: 99 },
    ]
    expect(sel.sessionsOnDay(sessions, NOW)).toHaveLength(2)
    const st = sel.todayFocusStats(sessions, NOW)
    expect(st.count).toBe(2)
    expect(st.minutes).toBe(55)
  })

  it('sessionsOfTarget 按目标过滤并倒序', () => {
    const sessions = [
      { id: 'a', targetType: 'todo', targetId: 't1', startAt: 1 },
      { id: 'b', targetType: 'todo', targetId: 't1', startAt: 3 },
      { id: 'c', targetType: 'projectSub', targetId: 's1', startAt: 2 },
    ]
    const list = sel.sessionsOfTarget(sessions, 'todo', 't1')
    expect(list.map((x) => x.id)).toEqual(['b', 'a'])
  })
})

describe('打卡派生', () => {
  let store
  const NOW = parseDateTimeStr('2026-09-02 12:00:00')
  const today = startOfDayTs(NOW)

  function mkCheckin(over) {
    return { id: 'c1', name: '喝水', unit: '杯', dailyTargetCount: 8, fixedDurationMin: null, startDate: null, endDate: null, ...over }
  }

  beforeEach(() => {
    ;({ store } = makeStore(NOW))
  })

  it('checkinDayMet：次数型达标判定', () => {
    const c = mkCheckin({ dailyTargetCount: 8 })
    const recs = [
      { checkinId: 'c1', at: today + 3600000, count: 3, durationMin: 0 },
      { checkinId: 'c1', at: today + 7200000, count: 5, durationMin: 0 },
    ]
    const map = sel.indexCheckinRecords(recs, 'c1')
    expect(sel.checkinDayMet(c, map, today)).toBe(true)
    expect(sel.dayRecordStats(map, today).counts).toBe(8)
  })

  it('checkinDayMet：时长型需要次数与时长达标', () => {
    const c = mkCheckin({ dailyTargetCount: 2, fixedDurationMin: 30 })
    const recs = [
      { checkinId: 'c1', at: today + 3600000, count: 1, durationMin: 30 },
      { checkinId: 'c1', at: today + 7200000, count: 1, durationMin: 20 },
    ]
    const map = sel.indexCheckinRecords(recs, 'c1')
    expect(sel.checkinDayMet(c, map, today)).toBe(false)
    recs[1].durationMin = 30
    const map2 = sel.indexCheckinRecords(recs, 'c1')
    expect(sel.checkinDayMet(c, map2, today)).toBe(true)
  })

  it('checkinDayMet：固定次数 / 计数最低次数 / 计数不限次数', () => {
    const day = today
    // 固定次数
    const fixed = mkCheckin({ dailyTargetCount: 3, rule: 'fixed' })
    const r1 = { checkinId: 'c1', at: day + 3600000, count: 2, durationMin: 0 }
    expect(sel.checkinDayMet(fixed, sel.indexCheckinRecords([r1], 'c1'), day)).toBe(false)
    r1.count = 3
    expect(sel.checkinDayMet(fixed, sel.indexCheckinRecords([r1], 'c1'), day)).toBe(true)
    // 计数模式 + 每日最低
    const min = mkCheckin({ dailyTargetCount: 5, rule: 'count' })
    const r2 = { checkinId: 'c1', at: day + 3600000, count: 5, durationMin: 0 }
    expect(sel.checkinDayMet(min, sel.indexCheckinRecords([r2], 'c1'), day)).toBe(true)
    r2.count = 4
    expect(sel.checkinDayMet(min, sel.indexCheckinRecords([r2], 'c1'), day)).toBe(false)
    // 计数模式 + 不限次数：有记录即达标
    const free = mkCheckin({ dailyTargetCount: 1, rule: 'count', countUnlimited: true })
    expect(sel.checkinDayMet(free, {}, day)).toBe(false)
    const r3 = { checkinId: 'c1', at: day + 3600000, count: 1, durationMin: 0 }
    expect(sel.checkinDayMet(free, sel.indexCheckinRecords([r3], 'c1'), day)).toBe(true)
  })

  it('checkinTodayProgressText 各规则文案', () => {
    const s = { counts: 3, totalDuration: 0 }
    expect(sel.checkinTodayProgressText(mkCheckin({ dailyTargetCount: 8 }), s)).toBe('3/8 杯')
    expect(sel.checkinTodayProgressText(mkCheckin({ dailyTargetCount: 1, rule: 'count', countUnlimited: true }), s)).toBe('3 杯')
    expect(sel.checkinTodayProgressText(mkCheckin({ dailyTargetCount: 2, fixedDurationMin: 30 }), { counts: 1, totalDuration: 40 })).toBe('40/60 分钟')
  })

  it('checkinStreak 连续达标，今天未达标从昨天起算', () => {
    const c = mkCheckin({ dailyTargetCount: 1 })
    const recs = []
    // 昨天、前天达标，今天未达标
    recs.push({ checkinId: 'c1', at: today - DAY + 3600000, count: 1, durationMin: 0 })
    recs.push({ checkinId: 'c1', at: today - 2 * DAY + 3600000, count: 1, durationMin: 0 })
    const map = sel.indexCheckinRecords(recs, 'c1')
    expect(sel.checkinStreak(c, map, NOW)).toBe(2)
    // 今天也达标 → 3
    recs.push({ checkinId: 'c1', at: today + 3600000, count: 1, durationMin: 0 })
    const map2 = sel.indexCheckinRecords(recs, 'c1')
    expect(sel.checkinStreak(c, map2, NOW)).toBe(3)
    // 断档：四天前没有 → 依然 3（再往前是断的但前面连续 3 天成立）
  })

  it('checkinActive 受有效期限制', () => {
    expect(sel.checkinActive(mkCheckin({ startDate: null, endDate: null }), NOW)).toBe(true)
    expect(sel.checkinActive(mkCheckin({ startDate: today + DAY }), NOW)).toBe(false)
    expect(sel.checkinActive(mkCheckin({ startDate: today - DAY, endDate: today + DAY }), NOW)).toBe(true)
    expect(sel.checkinActive(mkCheckin({ endDate: today - DAY }), NOW)).toBe(false)
  })

  it('checkinTodayList 汇总今日状态', () => {
    const c = mkCheckin({ dailyTargetCount: 3 })
    store._replace({
      checkins: [c],
      checkinRecords: [{ checkinId: 'c1', at: today + 3600000, count: 2, durationMin: 0 }],
    })
    const list = sel.checkinTodayList(store.state, NOW)
    expect(list[0].stat.counts).toBe(2)
    expect(list[0].met).toBe(false)
    expect(list[0].active).toBe(true)
  })
})

describe('日历聚合', () => {
  let store
  const NOW = parseDateTimeStr('2026-09-02 12:00:00')
  const dayStart = startOfDayTs(NOW)
  beforeEach(() => {
    ;({ store } = makeStore(NOW))
  })

  it('calendarItems 聚合 date/datetime/range 任务与专注会话', () => {
    const mk = (id, timeType, startAt, endAt = null) => ({
      id,
      title: id,
      timeType,
      startAt,
      endAt,
      completed: false,
    })
    store._replace({
      todos: [
        mk('allday', 'date', dayStart),
        mk('point', 'datetime', dayStart + 9 * 3600000),
        mk('range', 'range', dayStart - 2 * 3600000, dayStart + 2 * 3600000),
        mk('out', 'datetime', dayStart + 2 * DAY),
      ],
      sessions: [{ id: 'se1', startAt: dayStart + 10 * 3600000, endAt: dayStart + 10.5 * 3600000, durationMin: 30 }],
    })
    const items = sel.calendarItems(store.state, dayStart, dayStart + DAY)
    const kinds = items.map((i) => i.kind).sort()
    expect(kinds).toContain('allDay')
    expect(kinds).toContain('point')
    expect(kinds).toContain('range')
    expect(kinds).toContain('session')
    expect(items.some((i) => i.id === 'out')).toBe(false)
  })

  it('range 任务只在与查询区间相交时出现', () => {
    const mk = (id, timeType, startAt, endAt) => ({ id, title: id, timeType, startAt, endAt, completed: false })
    store._replace({
      todos: [mk('cross', 'range', dayStart - DAY, dayStart + DAY)],
      sessions: [],
    })
    const items = sel.calendarItems(store.state, dayStart, dayStart + DAY)
    expect(items).toHaveLength(1)
    expect(items[0].startTs).toBe(dayStart)
    expect(items[0].endTs).toBe(dayStart + DAY)
  })
})

describe('标签聚合', () => {
  let store
  const NOW = parseDateTimeStr('2026-09-02 12:00:00')
  beforeEach(() => {
    ;({ store } = makeStore(NOW))
  })

  it('项目任务同样被日历聚合并附项目名', () => {
    const dayStart = startOfDayTs(NOW)
    const p = { id: 'p9', name: '毕业论文' }
    store._replace({
      projects: [p],
      todos: [seedTodo({ id: 'pt1', projectId: 'p9', timeType: 'datetime', startAt: dayStart + 9 * 3600000 })],
      sessions: [],
    })
    const items = sel.calendarItems(store.state, dayStart, dayStart + DAY_MS)
    expect(items.some((i) => i.id === 'pt1')).toBe(true)
    expect(items.find((i) => i.id === 'pt1').pName).toBe('毕业论文')
  })

  it('tagCounts 统计三类关联数', () => {
    store._replace({
      tags: [{ id: 'tg1', name: '重要', color: '#E11D48' }],
      todos: [seedTodo({ id: 't1', tagIds: ['tg1'] }), seedTodo({ id: 't2', tagIds: ['tg1'] }), seedTodo({ id: 's1', projectId: 'p1', tagIds: ['tg1'] })],
      projects: [{ id: 'p1', name: 'P', tagIds: ['tg1'] }],
    })
    const c = sel.tagCounts(store.state)
    expect(c.tg1).toEqual({ todo: 2, project: 1, sub: 1 })
  })

  it('tagEntities 分组返回关联实体', () => {
    store._replace({
      tags: [{ id: 'tg1', name: 'x', color: '#000' }],
      todos: [seedTodo({ id: 't1', tagIds: ['tg1'] }), seedTodo({ id: 't2', tagIds: [] }), seedTodo({ id: 's1', projectId: 'p1', tagIds: ['tg1'] })],
      projects: [{ id: 'p1', name: 'P', tagIds: ['tg1'] }],
    })
    const e = sel.tagEntities(store.state, 'tg1')
    expect(e.todos.map((x) => x.id)).toEqual(['t1'])
    expect(e.projects.map((x) => x.id)).toEqual(['p1'])
    expect(e.subTasks.map((x) => x.id)).toEqual(['s1'])
  })

  it('tagsOf / tagOf', () => {
    store._replace({ tags: [{ id: 'a', name: 'A', color: '#111' }, { id: 'b', name: 'B', color: '#222' }] })
    expect(sel.tagOf(store.state, 'a').name).toBe('A')
    expect(sel.tagsOf(store.state, ['a', 'zzz', 'b']).map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('复盘派生', () => {
  let store
  const NOW = parseDateTimeStr('2026-09-02 12:00:00')
  beforeEach(() => {
    ;({ store } = makeStore(NOW))
  })

  it('reviewsFor 按周期过滤并按 periodDate 倒序', () => {
    store._replace({
      reviews: [
        { id: 'r1', type: 'day', periodDate: 10, fields: {} },
        { id: 'r2', type: 'day', periodDate: 30, fields: {} },
        { id: 'r3', type: 'week', periodDate: 20, fields: {} },
      ],
    })
    const days = sel.reviewsFor(store.state, 'day')
    expect(days.map((x) => x.id)).toEqual(['r2', 'r1'])
    expect(sel.reviewsFor(store.state, 'week').map((x) => x.id)).toEqual(['r3'])
  })

  it('completedTodosInRange / archivedProjectsInRange', () => {
    const d = startOfDayTs(NOW)
    store._replace({
      todos: [
        seedTodo({ id: 'in1', completed: true, completedAt: d + 1000 }),
        seedTodo({ id: 'in2', completed: true, completedAt: d + 2000 }),
        seedTodo({ id: 'out1', completed: true, completedAt: d - DAY }),
        seedTodo({ id: 'no', completed: false }),
      ],
      projects: [{ id: 'pa', name: 'P', completed: true, completedAt: d + 1000 }],
    })
    const [s, e] = [d, d + DAY]
    const list = sel.completedTodosInRange(store.state, s, e)
    expect(list.map((x) => x.id).sort()).toEqual(['in1', 'in2'])
    expect(sel.archivedProjectsInRange(store.state, s, e).map((x) => x.id)).toEqual(['pa'])
  })
})
