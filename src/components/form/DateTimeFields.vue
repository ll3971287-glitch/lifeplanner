<template>
  <div>
    <SegControl
      :model-value="timeType"
      :options="modeOptions"
      class="time-type-seg"
      @update:model-value="switchMode"
    />

    <div v-if="timeType !== 'none'" class="time-fields">
      <template v-if="timeType === 'date'">
        <div class="field">
          <span class="field-label">日期</span>
          <input type="date" class="input" :value="dateStr(startAt)" @change="onDateChange($event.target.value)" />
        </div>
      </template>

      <template v-else-if="timeType === 'datetime'">
        <div class="two-col">
          <div class="field">
            <span class="field-label">日期</span>
            <input type="date" class="input" :value="dateStr(startAt)" @change="onDateTimeChange($event.target.value, timeStr(startAt))" />
          </div>
          <div class="field">
            <span class="field-label">时间（时分秒）</span>
            <input type="time" step="1" class="input" :value="timeStr(startAt)" @change="onDateTimeChange(dateStr(startAt), $event.target.value)" />
          </div>
        </div>
      </template>

      <template v-else>
        <div class="range-block">
          <div class="two-col">
            <div class="field">
              <span class="field-label">开始日期</span>
              <input type="date" class="input" :value="dateStr(startAt)" @change="onStartChange($event.target.value, timeStr(startAt))" />
            </div>
            <div class="field">
              <span class="field-label">开始时间</span>
              <input type="time" step="1" class="input" :value="timeStr(startAt)" @change="onStartChange(dateStr(startAt), $event.target.value)" />
            </div>
          </div>
          <div class="two-col">
            <div class="field">
              <span class="field-label">结束日期</span>
              <input type="date" class="input" :value="dateStr(endAt)" @change="onEndChange($event.target.value, timeStr(endAt))" />
            </div>
            <div class="field">
              <span class="field-label">结束时间</span>
              <input type="time" step="1" class="input" :value="timeStr(endAt)" @change="onEndChange(dateStr(endAt), $event.target.value)" />
            </div>
          </div>
        </div>
      </template>

      <div class="quick-row">
        <button type="button" class="quick-chip" @click="quickToday">今天</button>
        <button type="button" class="quick-chip" @click="quickTomorrow">明天</button>
        <button v-if="timeType !== 'date'" type="button" class="quick-chip" @click="quickNow">当前时刻</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SegControl from '../ui/SegControl.vue'
import { parseDateStr, parseDateTimeStr, addDaysTs, startOfDayTs, fmtDate, fmtTime } from '../../utils/date.js'

const props = defineProps({
  modelValue: { type: Object, default: () => ({ timeType: 'none', startAt: null, endAt: null }) },
})

const emit = defineEmits(['update:modelValue'])

const timeType = ref(props.modelValue.timeType || 'none')
const startAt = ref(props.modelValue.startAt)
const endAt = ref(props.modelValue.endAt)

const modeOptions = [
  { label: '无时间', value: 'none' },
  { label: '全天', value: 'date' },
  { label: '时间点', value: 'datetime' },
  { label: '时间段', value: 'range' },
]

function push() {
  emit('update:modelValue', { timeType: timeType.value, startAt: startAt.value, endAt: endAt.value })
}

function dateStr(ts) {
  if (ts == null) return ''
  return fmtDate(ts)
}

function timeStr(ts) {
  if (ts == null) return '09:00:00'
  return fmtTime(ts, true)
}

function switchMode(mode) {
  timeType.value = mode
  const now = Date.now()
  if (mode === 'date') {
    startAt.value = startAt.value != null ? startOfDayTs(startAt.value) : startOfDayTs(now)
    endAt.value = null
  } else if (mode === 'datetime') {
    if (startAt.value == null) startAt.value = now
    endAt.value = null
  } else if (mode === 'range') {
    if (startAt.value == null) startAt.value = now
    if (endAt.value == null || endAt.value <= startAt.value) endAt.value = startAt.value + 3600000
  } else {
    startAt.value = null
    endAt.value = null
  }
  push()
}

function onDateChange(v) {
  startAt.value = v ? parseDateStr(v) : null
  push()
}

function onDateTimeChange(d, t) {
  if (d && t) startAt.value = parseDateTimeStr(`${d} ${t}`)
  else if (d) startAt.value = parseDateStr(d)
  push()
}

function onStartChange(d, t) {
  if (d && t) startAt.value = parseDateTimeStr(`${d} ${t}`)
  push()
}

function onEndChange(d, t) {
  if (d && t) endAt.value = parseDateTimeStr(`${d} ${t}`)
  push()
}

function quickToday() {
  const base = startOfDayTs(Date.now())
  if (timeType.value === 'date') {
    startAt.value = base
  } else if (timeType.value === 'datetime') {
    startAt.value = base + 9 * 3600000
  } else if (timeType.value === 'range') {
    startAt.value = base + 9 * 3600000
    endAt.value = base + 10 * 3600000
  }
  push()
}

function quickTomorrow() {
  const base = startOfDayTs(addDaysTs(Date.now(), 1))
  if (timeType.value === 'date') {
    startAt.value = base
  } else if (timeType.value === 'datetime') {
    startAt.value = base + 9 * 3600000
  } else if (timeType.value === 'range') {
    startAt.value = base + 9 * 3600000
    endAt.value = base + 10 * 3600000
  }
  push()
}

function quickNow() {
  const now = Date.now()
  if (timeType.value === 'datetime') {
    startAt.value = now
  } else if (timeType.value === 'range') {
    startAt.value = now
    endAt.value = now + 3600000
  }
  push()
}

// 同步外部 modelValue（编辑回显）
const outer = computed(() => props.modelValue)
</script>

<style scoped>
.time-type-seg {
  margin-bottom: 12px;
}

.time-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.field {
  min-width: 0;
}

.quick-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.quick-chip {
  padding: 5px 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 35%, transparent);
  color: var(--primary-deep);
  font-size: 12.5px;
  font-weight: 600;
}
</style>
