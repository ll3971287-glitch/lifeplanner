<template>
  <div class="month">
    <div class="week-head">
      <span v-for="d in ['周一', '周二', '周三', '周四', '周五', '周六', '周日']" :key="d" class="wh-item">{{ d }}</span>
    </div>
    <div class="grid">
      <div
        v-for="day in grid"
        :key="day"
        class="cell"
        :class="{ out: !inMonth(day), today: isToday(day) }"
        @click="$emit('day-create', day)"
      >
        <span class="day-num" :class="{ today: isToday(day) }">{{ new Date(day).getDate() }}</span>
        <div class="cell-items">
          <button
            v-for="it in dayTodos(day)"
            :key="'t' + it.todo.id"
            type="button"
            class="cell-item todo"
            :class="{ done: it.todo.completed, 'tag-colored': hasTagColor(it.todo) }"
            :style="itemBg(it.todo)"
            @click.stop="$emit('item-click', it.todo)"
          >
            <i class="dot" />
            <span class="txt">{{ itemTitle(it) }}</span>
          </button>
          <button
            v-for="bp in dayBlueprints(day)"
            :key="'bp' + bp.id"
            type="button"
            class="cell-item blueprint"
            @click.stop="$emit('item-click', { type: 'blueprint', bp })"
          >
            <Icon name="flag" :size="9" />
            <span class="txt">{{ bp.title }}</span>
          </button>
          <div v-if="sessionText(day)" class="cell-item focus-text">
            <Icon name="clock" :size="10" />
            <span>{{ sessionText(day) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { store } from '../../store.js'
import { calendarItems } from '../../selectors.js'
import { monthGridTs, DAY_MS, startOfDayTs, fmtDate } from '../../utils/date.js'
import Icon from '../ui/Icon.vue'

const props = defineProps({
  year: { type: Number, required: true },
  month: { type: Number, required: true },
})

defineEmits(['day-create', 'item-click'])

const grid = computed(() => monthGridTs(props.year, props.month))

const monthStart = computed(() => new Date(props.year, props.month, 1).getTime())
const monthEnd = computed(() => new Date(props.year, props.month + 1, 1).getTime())

const items = computed(() => calendarItems(store.state, monthStart.value, monthEnd.value))

function inMonth(day) {
  return day >= monthStart.value && day < monthEnd.value
}

function isToday(day) {
  return day === startOfDayTs(Date.now())
}

function dayTodos(day) {
  return items.value.filter((it) => {
    if (it.kind === 'session' || !it.todo) return false
    if (it.kind === 'allDay') return it.ts === day
    if (it.kind === 'point') return it.ts >= day && it.ts < day + DAY_MS
    return it.ts < day + DAY_MS && it.endTs > day
  })
}

function dayBlueprints(day) {
  return items.value.filter((it) => it.ref === 'blueprint' && it.ts === day).map((it) => it.blueprint)
}

function sessionText(day) {
  const list = items.value.filter((it) => it.kind === 'session' && it.ts >= day && it.ts < day + DAY_MS)
  if (!list.length) return ''
  const total = list.reduce((a, s) => a + (s.session.durationMin || 0), 0)
  return `${list.length} 次 · ${total} 分钟`
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

.grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(90px, 1fr));
  min-width: 630px;
}

.cell {
  min-height: 92px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 4px;
  cursor: pointer;
  position: relative;
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

.cell-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
  overflow: hidden;
}

.cell-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 5px;
  max-width: 100%;
}

.cell-item.todo {
  background: color-mix(in srgb, var(--primary) 38%, transparent);
  color: var(--primary-deep);
}

.cell-item.todo.done {
  opacity: 0.55;
  text-decoration: line-through;
}

.cell-item.todo.tag-colored {
  color: #fff;
}

.cell-item.todo.tag-colored .dot {
  background: rgba(255, 255, 255, 0.9);
}

.cell-item.blueprint {
  border: 1px dashed color-mix(in srgb, var(--accent) 60%, transparent);
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  padding: 1px 4px;
  font-style: normal;
}

.cell-item.focus-text {
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  font-size: 10.5px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
}

.txt {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
