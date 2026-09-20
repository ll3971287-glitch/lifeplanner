<template>
  <BaseModal :open="open" title="安排时间" @close="$emit('close')">
    <div class="sm">
      <p v-if="todo" class="muted mini task-name">{{ todo.title }}</p>

      <div class="field">
        <span class="field-label">时间类型</span>
        <SegControl :model-value="mode" :options="modeOptions" @update:model-value="mode = $event" />
      </div>

      <div v-if="mode !== 'none'" class="row gap6 wrap quick-days">
        <button v-for="q in quickDays" :key="q.label" type="button" class="day-chip" @click="applyDay(q.ts)">
          {{ q.label }}
        </button>
      </div>

      <!-- 全天 -->
      <div v-if="mode === 'date'" class="field">
        <span class="field-label">日期</span>
        <input v-model="dateStr" type="date" class="input" />
      </div>

      <!-- 时间点 -->
      <template v-else-if="mode === 'datetime'">
        <div class="two-col">
          <div class="field">
            <span class="field-label">日期</span>
            <input v-model="dateStr" type="date" class="input" />
          </div>
          <div class="field">
            <span class="field-label">时间</span>
            <input v-model="timeStr" type="time" class="input" />
          </div>
        </div>
      </template>

      <!-- 时间段 -->
      <template v-else-if="mode === 'range'">
        <div class="field">
          <span class="field-label">开始</span>
          <div class="two-col">
            <input v-model="startDateStr" type="date" class="input" />
            <input v-model="startTimeStr" type="time" class="input" />
          </div>
        </div>
        <div class="field">
          <span class="field-label">结束</span>
          <div class="two-col">
            <input v-model="endDateStr" type="date" class="input" />
            <input v-model="endTimeStr" type="time" class="input" />
          </div>
        </div>
      </template>

      <p v-else class="muted mini">选择「无时间」保存后会清除该任务的时间安排。</p>

      <div class="row gap8" style="justify-content: flex-end">
        <button type="button" class="btn btn-outline btn-sm" @click="$emit('close')">取消</button>
        <button type="button" class="btn btn-primary btn-sm" @click="save">保存</button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import SegControl from '../ui/SegControl.vue'
import { store } from '../../store.js'
import { fmtDate, parseDateStr, startOfDayTs, addDaysTs, DAY_MS, pad } from '../../utils/date.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  todoId: { type: String, default: null },
})
const emit = defineEmits(['close', 'saved'])

const todo = computed(() => store.state.todos.find((t) => t.id === props.todoId) || null)

const modeOptions = [
  { label: '无时间', value: 'none' },
  { label: '全天', value: 'date' },
  { label: '时间点', value: 'datetime' },
  { label: '时间段', value: 'range' },
]

const mode = ref('datetime')
const dateStr = ref('')
const timeStr = ref('09:00')
const startDateStr = ref('')
const startTimeStr = ref('09:00')
const endDateStr = ref('')
const endTimeStr = ref('18:00')

const quickDays = computed(() => {
  const today = startOfDayTs(Date.now())
  const weekStart = today - ((new Date(today).getDay() + 6) % 7) * DAY_MS
  const nextMonday = addDaysTs(weekStart, 7)
  return [
    { label: '今天', ts: today },
    { label: '明天', ts: addDaysTs(today, 1) },
    { label: '本周末', ts: addDaysTs(weekStart, 5) },
    { label: '下周一', ts: nextMonday },
  ]
})

function hm(ts) {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

watch(
  () => [props.open, props.todoId],
  () => {
    if (!props.open || !todo.value) return
    const t = todo.value
    const today = startOfDayTs(Date.now())
    mode.value = t.timeType === 'none' ? 'datetime' : t.timeType
    dateStr.value = fmtDate(t.startAt || today)
    timeStr.value = t.startAt ? hm(t.startAt) : '09:00'
    startDateStr.value = fmtDate(t.startAt || today)
    startTimeStr.value = t.startAt ? hm(t.startAt) : '09:00'
    endDateStr.value = fmtDate(t.endAt || t.startAt || today)
    endTimeStr.value = t.endAt ? hm(t.endAt) : '18:00'
  },
  { immediate: true }
)

function applyDay(ts) {
  const ds = fmtDate(ts)
  dateStr.value = ds
  startDateStr.value = ds
  if (!endDateStr.value || endDateStr.value < ds) endDateStr.value = ds
}

function tsOf(dateS, timeS) {
  if (!dateS) return null
  const day = parseDateStr(dateS)
  const [h, m] = (timeS || '00:00').split(':').map(Number)
  return day + (h || 0) * 3600000 + (m || 0) * 60000
}

function save() {
  if (!todo.value) return
  if (mode.value === 'none') {
    store.updateTodo(todo.value.id, { timeType: 'none' })
  } else if (mode.value === 'date') {
    store.updateTodo(todo.value.id, { timeType: 'date', startAt: dateStr.value ? parseDateStr(dateStr.value) : null })
  } else if (mode.value === 'datetime') {
    const startAt = tsOf(dateStr.value, timeStr.value)
    if (startAt == null) return
    store.updateTodo(todo.value.id, { timeType: 'datetime', startAt })
  } else {
    const startAt = tsOf(startDateStr.value, startTimeStr.value)
    const endAt = tsOf(endDateStr.value, endTimeStr.value)
    if (startAt == null || endAt == null) return
    store.updateTodo(todo.value.id, { timeType: 'range', startAt, endAt: Math.max(endAt, startAt) })
  }
  emit('saved')
  emit('close')
}
</script>

<style scoped>
.sm {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-name {
  margin: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--muted);
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.input {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
}

.quick-days {
  align-items: center;
}

.day-chip {
  font-size: 12.5px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--muted);
}

.day-chip:hover {
  border-color: var(--accent);
  color: var(--accent-deep);
}
</style>
