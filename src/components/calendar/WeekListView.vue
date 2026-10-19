<template>
  <div class="week-list">
    <div v-for="day in days" :key="day" class="day-col" :class="{ today: isToday(day) }">
      <button type="button" class="day-head" :title="`新增 ${fmtDate(day)} 的任务`" @click="$emit('create', day + 9 * 3600000)">
        <span class="wd">{{ weekdayOf(day) }}</span>
        <span class="dd">{{ dayNum(day) }}</span>
      </button>

      <div class="items">
        <button
          v-for="it in itemsOf(day)"
          :key="it.id"
          type="button"
          class="item"
          :class="{ done: it.todo.completed }"
          :style="itemStyle(it)"
          @click="$emit('item-click', it.todo)"
        >
          <span class="t">{{ timeText(it) }}</span>
          <span class="n">{{ it.todo.title }}</span>
        </button>
        <p v-if="moreOf(day)" class="more muted">+{{ moreOf(day) }} 更多</p>
        <p v-if="!itemsOf(day).length" class="empty muted">暂无任务</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { store } from '../../store.js'
import { calendarItems } from '../../selectors.js'
import { fmtDate, startOfDayTs, fmtTime, DAY_MS } from '../../utils/date.js'
import { weekdayOf } from '../../format.js'
import { tagsOf } from '../../selectors.js'

const props = defineProps({
  // 本周的 7 个日期戳（当天 00:00）
  days: { type: Array, required: true },
})

defineEmits(['item-click', 'create'])

const MAX_PER_DAY = 3

const allByDay = computed(() => {
  const map = {}
  for (const day of props.days) {
    const list = calendarItems(store.state, day, day + DAY_MS)
      .filter((it) => it.ref === 'todo' && it.todo)
      .sort((a, b) => {
        // 全天任务排最前，其余按开始时间
        const ka = a.kind === 'allDay' ? -1 : a.ts
        const kb = b.kind === 'allDay' ? -1 : b.ts
        return ka - kb
      })
    map[day] = list
  }
  return map
})

function itemsOf(day) {
  return (allByDay.value[day] || []).slice(0, MAX_PER_DAY)
}

function moreOf(day) {
  const total = (allByDay.value[day] || []).length
  return total > MAX_PER_DAY ? total - MAX_PER_DAY : 0
}

function timeText(it) {
  if (it.kind === 'allDay') return '全天'
  if (it.kind === 'range') {
    const sameDay = startOfDayTs(it.endTs) === startOfDayTs(it.startTs)
    return sameDay ? `${fmtTime(it.startTs)}-${fmtTime(it.endTs)}` : `${fmtTime(it.startTs)} 起`
  }
  return fmtTime(it.ts)
}

function itemStyle(it) {
  const tags = tagsOf(store.state, it.todo.tagIds || [])
  const color = tags.length ? tags[0].color : null
  return color ? { borderLeft: `3px solid ${color}` } : {}
}

function isToday(day) {
  return startOfDayTs(Date.now()) === day
}

function dayNum(day) {
  return new Date(day).getDate()
}
</script>

<style scoped>
.week-list {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
  padding: 8px 8px 12px;
}

.day-col {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: color-mix(in srgb, var(--line) 22%, transparent);
  border-radius: 12px;
  padding: 7px 6px;
}

.day-col.today {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  outline: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
}

.day-head {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  padding: 2px 0 4px;
  border-bottom: 1px dashed var(--line);
  color: var(--text-dim);
}

.day-col.today .day-head {
  color: var(--accent-deep);
}

.wd {
  font-size: 11px;
  font-weight: 700;
}

.dd {
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
}

.day-col.today .dd {
  color: var(--accent-deep);
}

.items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  text-align: left;
  padding: 5px 6px;
  border-radius: 8px;
  background: var(--card);
  border: 1px solid var(--line);
  border-left: 3px solid transparent;
  min-width: 0;
}

.item:active {
  transform: scale(0.98);
}

.item.done .n {
  color: var(--text-dim);
  text-decoration: line-through;
}

.t {
  font-size: 10.5px;
  font-weight: 800;
  color: var(--accent-deep);
}

.n {
  font-size: 12px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.more,
.empty {
  margin: 0;
  font-size: 10.5px;
  text-align: center;
  padding: 2px 0;
}
</style>
