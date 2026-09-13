<template>
  <div class="timeline">
    <div class="cols">
      <!-- 时间刻度列 -->
      <div class="gutter">
        <div class="all-day-head">全天</div>
        <div class="body" :style="{ height: bodyH + 'px' }">
          <div v-for="h in 24" :key="h" class="hour-line" :style="{ top: h * HOUR_PX + 'px' }">
            <span v-if="h % 2 === 0" class="hour-label">{{ String(h).padStart(2, '0') }}:00</span>
          </div>
        </div>
      </div>

      <!-- 每列一天 -->
      <div v-for="day in days" :key="day" class="day-col" :class="{ today: isToday(day) }">
        <div class="day-head">{{ headLabel(day) }}</div>
        <div class="all-day-area">
          <button
            v-for="it in allDayTodoItems(day)"
            :key="it.id"
            type="button"
            class="all-day-item"
            :class="{ done: it.todo.completed, 'tag-colored': hasTagColor(it.todo) }"
            :style="itemBg(it.todo)"
            @click="$emit('item-click', it.todo)"
          >
            {{ itemTitle(it) }}
          </button>
          <button
            v-for="bp in allDayBlueprintItems(day)"
            :key="'bp' + bp.id"
            type="button"
            class="all-day-item bp-item"
            @click="$emit('item-click', { type: 'blueprint', bp })"
          >
            <i class="bp-dot" />
            {{ bp.title }}
          </button>
        </div>
        <div
          class="body"
          :style="{ height: bodyH + 'px' }"
          @click.self="createAt(day, $event)"
        >
          <div v-for="h in 24" :key="h" class="hour-line" :style="{ top: h * HOUR_PX + 'px' }" />
          <template v-for="it in timedItems(day)" :key="it.id">
            <button
              v-if="it.kind === 'point'"
              type="button"
              class="time-item point"
              :class="{ done: it.todo.completed }"
              :style="{ ...itemBg(it.todo), top: topOf(it, day) + 'px' }"
              @click.stop="$emit('item-click', it.todo)"
            >
              {{ itemTitle(it) }}
            </button>
            <button
              v-else
              type="button"
              class="time-item bar"
              :class="it.kind === 'session' ? 'session' : 'range'"
              :style="{ ...(it.kind === 'session' ? {} : itemBg(it.todo)), top: topOf(it, day) + 'px', height: Math.max(15, hOf(it, day)) + 'px' }"
              @click.stop="$emit(it.kind === 'session' ? 'session-click' : 'item-click', it.kind === 'session' ? it.session : it.todo)"
            >
              {{ labelOf(it) }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { store } from '../../store.js'
import { calendarItems } from '../../selectors.js'
import { DAY_MS, startOfDayTs, minuteOfDayTs, fmtDate } from '../../utils/date.js'
import { weekdayOf } from '../../format.js'

const props = defineProps({
  days: { type: Array, required: true }, // 1（日视图）或 7（周视图）个当天 00:00 的时间戳
})

const emit = defineEmits(['create', 'item-click', 'session-click'])

const HOUR_PX = 44
const bodyH = 24 * HOUR_PX

const spanStart = computed(() => startOfDayTs(props.days[0]))
const spanEnd = computed(() => props.days[props.days.length - 1] + DAY_MS)

const items = computed(() => calendarItems(store.state, spanStart.value, spanEnd.value))

function isToday(day) {
  return day === startOfDayTs(Date.now())
}

function createAt(day, e) {
  let minutes = 540
  const raw = e && typeof e.offsetY === 'number' && bodyH ? (e.offsetY / bodyH) * 1440 : NaN
  if (Number.isFinite(raw)) minutes = Math.max(0, Math.min(1410, Math.round(raw / 30) * 30))
  emit('create', day + minutes * 60000)
}

function headLabel(day) {
  const base = fmtDate(day)
  return props.days.length > 1 ? `${base.slice(5)} ${weekdayOf(day)}` : `${base} ${weekdayOf(day)}`
}

function allDayItems(day) {
  return items.value.filter((it) => it.kind === 'allDay' && it.ts === day)
}

function allDayTodoItems(day) {
  return allDayItems(day).filter((it) => it.ref !== 'blueprint')
}

function allDayBlueprintItems(day) {
  return allDayItems(day).filter((it) => it.ref === 'blueprint').map((it) => it.blueprint)
}

function timedItems(day) {
  return items.value.filter((it) => {
    if (it.kind === 'allDay') return false
    if (it.kind === 'point') return it.ts >= day && it.ts < day + DAY_MS
    return it.ts < day + DAY_MS && it.endTs > day
  })
}

function clip(day, it) {
  const s = Math.max(it.ts, day)
  const e = it.kind === 'point' ? s + 1800000 : Math.min(it.endTs || it.ts + 3600000, day + DAY_MS)
  return [s, Math.max(s + 60000, e)]
}

function topOf(it, day) {
  const [s] = clip(day, it)
  return (minuteOfDayTs(s) / 1440) * bodyH
}

function hOf(it, day) {
  const [, e] = clip(day, it)
  const s = Math.max(it.ts, day)
  return ((e - s) / DAY_MS) * bodyH
}

function labelOf(it) {
  if (it.kind === 'session') {
    const mode = it.session.mode === 'pomodoro' ? '番茄' : '自由'
    return `${mode} ${it.session.durationMin || ''}m`
  }
  return it.todo ? itemTitle(it) : ''
}

function itemTitle(it) {
  return it.todo && it.pName ? `${it.pName} · ${it.todo.title}` : it.todo ? it.todo.title : ''
}

function firstTagColor(todo) {
  if (!todo) return null
  const id = (todo.tagIds || [])[0]
  if (!id) return null
  const tg = store.state.tags.find((t) => t.id === id)
  return tg ? tg.color : null
}

function hasTagColor(todo) {
  return !!firstTagColor(todo)
}

function itemBg(todo) {
  const c = firstTagColor(todo)
  return c ? { background: c, color: '#fff' } : null
}
</script>

<style scoped>
.timeline {
  overflow-x: auto;
}

.cols {
  display: flex;
  min-width: 560px;
}

.gutter {
  width: 58px;
  flex: none;
  position: relative;
}

.day-col {
  flex: 1;
  min-width: 86px;
  border-left: 1px solid var(--line);
  position: relative;
}

.day-head {
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-dim);
  padding: 4px 0;
  position: sticky;
  top: 0;
  background: var(--card);
  z-index: 2;
}

.day-col.today .day-head {
  color: var(--primary-deep);
  background: color-mix(in srgb, var(--primary) 30%, transparent);
  border-radius: 0 0 8px 8px;
}

.all-day-head {
  font-size: 10px;
  color: var(--text-dim);
  padding: 4px 2px;
  text-align: right;
}

.all-day-area {
  min-height: 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 2px 3px;
  border-bottom: 1px solid var(--line);
}

.all-day-item {
  font-size: 11.5px;
  background: color-mix(in srgb, var(--primary) 45%, transparent);
  color: var(--primary-deep);
  border-radius: 6px;
  padding: 1px 6px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-align: left;
}

.all-day-item.done {
  text-decoration: line-through;
  opacity: 0.6;
}

.all-day-item.tag-colored {
  color: #fff;
}

.all-day-item.bp-item {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--accent-deep);
  border: 1px dashed color-mix(in srgb, var(--accent) 55%, transparent);
  display: flex;
  align-items: center;
  gap: 5px;
}

.bp-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
}

.body {
  position: relative;
}

.hour-line {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid var(--line);
  pointer-events: none;
}

.hour-label {
  position: absolute;
  top: -7px;
  right: 4px;
  font-size: 10px;
  color: var(--text-dim);
  background: var(--card);
  padding: 0 2px;
}

.time-item {
  position: absolute;
  left: 2px;
  right: 2px;
  font-size: 11px;
  border-radius: 7px;
  padding: 1px 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  z-index: 1;
}

.time-item.point {
  transform: translateY(-50%);
  height: 20px;
  background: var(--accent-deep);
  color: #fff;
}

.time-item.point.done {
  opacity: 0.5;
  text-decoration: line-through;
}

.time-item.bar.range {
  background: color-mix(in srgb, var(--primary-deep) 82%, transparent);
  color: #fff;
}

.time-item.bar.session {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  color: var(--accent-deep);
  border: 1px dashed color-mix(in srgb, var(--accent) 55%, transparent);
}
</style>
