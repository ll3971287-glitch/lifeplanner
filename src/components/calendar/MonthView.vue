<template>
  <div class="month">
    <div class="week-head">
      <span v-for="d in ['周一', '周二', '周三', '周四', '周五', '周六', '周日']" :key="d" class="wh-item">{{ d }}</span>
    </div>

    <div class="weeks">
      <div v-for="(week, wi) in weeks" :key="wi" class="week-row">
        <div class="cells">
          <div
            v-for="day in week"
            :key="day"
            class="cell"
            :class="{ out: !inMonth(day), today: isToday(day) }"
            @click="$emit('day-create', day)"
          >
            <span class="day-num" :class="{ today: isToday(day) }">{{ new Date(day).getDate() }}</span>
            <span v-if="sessionText(day)" class="focus-text">
              <Icon name="clock" :size="9" />
              {{ sessionText(day) }}
            </span>
          </div>
        </div>

        <!-- 跨期长条：同一任务只画一条，横跨起止日期 -->
        <div class="bars" :style="{ height: laneCount(wi) * BAR_H + 'px' }">
          <button
            v-for="b in weekBars(wi)"
            :key="b.key"
            type="button"
            class="span-bar"
            :class="[b.cls, { done: b.done }]"
            :style="{ left: colLeft(b.colStart), width: colWidth(b.colSpan), top: b.lane * BAR_H + 'px', background: b.bg, borderColor: b.border }"
            @click.stop="onBarClick(b)"
            @mouseenter="showTip(b, $event)"
            @mouseleave="hideTip"
            @pointerdown="startLongPress(b, $event)"
            @pointerup="cancelLongPress"
            @pointercancel="cancelLongPress"
            @pointerleave="cancelLongPress"
          >
            <span class="bar-label">{{ b.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 简要信息浮窗 -->
    <Teleport to="body">
      <div v-if="tip.show" class="cal-tip card" :style="{ left: tip.x + 'px', top: tip.y + 'px' }">
        <div class="tip-head">
          <i class="tip-dot" :style="{ background: tip.bg }" />
          <span class="tip-title">{{ tip.title }}</span>
          <span v-if="tip.status" class="tip-state">{{ tip.status }}</span>
        </div>
        <p v-if="tip.time" class="muted mini tip-line">{{ tip.time }}</p>
        <p v-if="tip.project" class="muted mini tip-line">项目：{{ tip.project }}</p>
        <p v-if="tip.tags" class="muted mini tip-line">标签：{{ tip.tags }}</p>
        <p v-if="tip.priority" class="muted mini tip-line">优先级：{{ tip.priority }}</p>
        <p class="muted mini tip-hint">点击可打开详情编辑</p>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { store } from '../../store.js'
import { calendarItems } from '../../selectors.js'
import { monthGridTs, DAY_MS, startOfDayTs, fmtDate, fmtTime } from '../../utils/date.js'
import { todoTimeText } from '../../format.js'
import Icon from '../ui/Icon.vue'

const props = defineProps({
  year: { type: Number, required: true },
  month: { type: Number, required: true },
})

const emit = defineEmits(['day-create', 'item-click'])

const BAR_H = 20

const grid = computed(() => monthGridTs(props.year, props.month))
const gridStart = computed(() => grid.value[0])
const monthStart = computed(() => new Date(props.year, props.month, 1).getTime())
const monthEnd = computed(() => new Date(props.year, props.month + 1, 1).getTime())

const items = computed(() => calendarItems(store.state, gridStart.value, gridStart.value + 42 * DAY_MS))

const weeks = computed(() => {
  const out = []
  for (let i = 0; i < 6; i += 1) out.push(grid.value.slice(i * 7, i * 7 + 7))
  return out
})

function inMonth(day) {
  return day >= monthStart.value && day < monthEnd.value
}
function isToday(day) {
  return day === startOfDayTs(Date.now())
}
function dayIndex(ts) {
  return Math.floor((startOfDayTs(ts) - gridStart.value) / DAY_MS)
}
function colLeft(col) {
  return `${(col / 7) * 100}%`
}
function colWidth(span) {
  return `calc(${(span / 7) * 100}% - 4px)`
}

// 任务/提示条：计算区间（含首尾整天）
function barOf(it) {
  const t = it.todo
  if (it.ref === 'blueprint') {
    const b = it.blueprint
    if (!b) return null
    return {
      key: 'bp' + b.id,
      item: { type: 'blueprint', bp: b },
      start: it.ts,
      end: it.ts,
      label: b.title,
      cls: 'blueprint',
      done: b.status === 'done',
      bg: 'color-mix(in srgb, var(--accent) 10%, transparent)',
      border: 'color-mix(in srgb, var(--accent) 55%, transparent)',
      title: b.title,
      timeText: b.goalEndTs ? `期望 ${fmtDate(b.goalEndTs)}` : b.goalText || '',
      status: '蓝图',
      project: '',
      tags: '',
      priority: '',
    }
  }
  if (!t) return null
  let start = it.ts
  let end = it.ts
  if (it.kind === 'range' && t.endAt != null) end = t.endAt
  const tagId = (t.tagIds || [])[0]
  const tg = tagId ? store.state.tags.find((x) => x.id === tagId) : null
  const proj = t.projectId ? store.state.projects.find((p) => p.id === t.projectId) : null
  const tagNames = (t.tagIds || [])
    .map((id) => (store.state.tags.find((x) => x.id === id) || {}).name)
    .filter(Boolean)
    .join('、')
  return {
    key: 't' + t.id,
    item: t,
    start,
    end,
    label: (t.timeType === 'datetime' ? `${fmtTime(t.startAt)} ` : '') + t.title,
    cls: 'todo',
    done: !!t.completed,
    bg: tg ? tg.color : 'color-mix(in srgb, var(--primary) 45%, transparent)',
    border: tg ? tg.color : 'color-mix(in srgb, var(--primary) 60%, transparent)',
    title: t.title,
    timeText: todoTimeText(t),
    status: t.completed ? '已完成' : t.canceled ? '已取消' : '未完成',
    project: proj ? proj.name : '',
    tags: tagNames,
    priority: { high: '高', medium: '中', low: '低' }[t.priority] || '',
  }
}

const bars = computed(() => {
  const out = []
  for (const it of items.value) {
    if (it.kind === 'session') continue
    const bar = barOf(it)
    if (!bar) continue
    out.push(bar)
  }
  // 供各周行切片用：天索引区间
  return out
    .map((b) => ({ ...b, sIdx: dayIndex(b.start), eIdx: dayIndex(b.end) }))
    .filter((b) => b.sIdx < 42 && b.eIdx >= 0)
})

// 每周行内的条 + 车道分配（互不重叠）
function weekBars(wi) {
  const rowStart = wi * 7
  const rowEnd = rowStart + 6
  const segs = []
  for (const b of bars.value) {
    if (b.sIdx > rowEnd || b.eIdx < rowStart) continue
    const colStart = Math.max(b.sIdx, rowStart) - rowStart
    const colEnd = Math.min(b.eIdx, rowEnd) - rowStart
    segs.push({ ...b, colStart, colSpan: colEnd - colStart + 1 })
  }
  segs.sort((a, b) => a.colStart - b.colStart || b.colSpan - a.colSpan)
  const laneEnds = []
  for (const s of segs) {
    let lane = laneEnds.findIndex((end) => end < s.colStart)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(-1)
    }
    laneEnds[lane] = s.colStart + s.colSpan - 1
    s.lane = lane
  }
  return segs
}

function laneCount(wi) {
  const segs = weekBars(wi)
  return segs.length ? Math.max(...segs.map((s) => s.lane)) + 1 : 0
}

function sessionText(day) {
  const list = items.value.filter((it) => it.kind === 'session' && it.ts >= day && it.ts < day + DAY_MS)
  if (!list.length) return ''
  const total = list.reduce((a, s) => a + (s.session.durationMin || 0), 0)
  return `${list.length} 次 · ${total}m`
}

// 点击：任务 → 打开详情编辑；蓝图 → 打开蓝图详情
function onBarClick(b) {
  if (longPressFired) {
    longPressFired = false
    return
  }
  emit('item-click', b.item)
}

// 悬浮 / 长按提示
const tip = ref({ show: false, x: 0, y: 0, title: '', bg: '', time: '', status: '', project: '', tags: '', priority: '' })
let pressTimer = null
let longPressFired = false

function placeTip(b, x, y) {
  tip.value = {
    show: true,
    x: Math.max(8, Math.min(x, window.innerWidth - 220)),
    y: Math.max(8, y),
    title: b.title,
    bg: b.bg,
    time: b.timeText,
    status: b.status,
    project: b.project,
    tags: b.tags,
    priority: b.priority,
  }
}

function showTip(b, e) {
  if (pressTimer) return
  placeTip(b, e.clientX + 10, e.clientY + 12)
}
function hideTip() {
  tip.value.show = false
}

function startLongPress(b, e) {
  cancelLongPress()
  longPressFired = false
  const x = e.clientX
  const y = e.clientY
  pressTimer = setTimeout(() => {
    longPressFired = true
    placeTip(b, x + 6, y + 8)
    pressTimer = null
  }, 450)
}
function cancelLongPress() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}
onBeforeUnmount(() => {
  cancelLongPress()
})

defineExpose({ weekBars, laneCount })
</script>

<style scoped>
.month {
  overflow-x: auto;
}

.week-head {
  display: grid;
  grid-template-columns: repeat(7, minmax(90px, 1fr));
}

.wh-item {
  text-align: center;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-dim);
  padding: 5px 0;
  border-bottom: 1px solid var(--line);
}

.weeks {
  min-width: 630px;
  display: flex;
  flex-direction: column;
}

.week-row {
  position: relative;
  border-bottom: 1px solid var(--line);
}

.cells {
  display: grid;
  grid-template-columns: repeat(7, minmax(90px, 1fr));
}

.cell {
  min-height: 76px;
  border-right: 1px solid var(--line);
  padding: 4px;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--card);
}

.cell.out {
  background: color-mix(in srgb, var(--bg) 60%, transparent);
  opacity: 0.55;
}

.cell.today {
  background: color-mix(in srgb, var(--primary) 16%, transparent);
}

.day-num {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-dim);
  align-self: flex-end;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.day-num.today {
  background: var(--primary-deep);
  color: #fff;
}

.focus-text {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  border-radius: 5px;
  padding: 0 4px;
}

/* 跨期长条层：叠在日期格子上，按列百分比定位 */
.bars {
  position: relative;
  margin-top: -8px;
  padding: 0 2px;
  z-index: 2;
  pointer-events: none;
}

.span-bar {
  position: absolute;
  height: 18px;
  border-radius: 6px;
  border: 1px solid;
  padding: 0 6px;
  text-align: left;
  overflow: hidden;
  display: flex;
  align-items: center;
  pointer-events: auto;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.span-bar.todo {
  color: var(--primary-deep);
}

.span-bar.blueprint {
  border-style: dashed;
  color: var(--accent-deep);
}

.span-bar.done {
  opacity: 0.6;
}

.span-bar.done .bar-label {
  text-decoration: line-through;
}

.bar-label {
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 信息浮窗 */
.cal-tip {
  position: fixed;
  z-index: 200;
  width: 210px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  pointer-events: none;
}

.tip-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.tip-title {
  font-size: 13.5px;
  font-weight: 800;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tip-state {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--muted);
  background: var(--line);
  border-radius: 999px;
  padding: 1px 7px;
  flex: none;
}

.tip-line {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tip-hint {
  margin: 2px 0 0;
  opacity: 0.8;
}
</style>
