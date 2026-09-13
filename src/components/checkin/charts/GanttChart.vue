<template>
  <div class="chart-box">
    <div class="toolbar-row">
      <button type="button" class="mini-btn" :disabled="offsetDays <= 0" @click="$emit('update:offset', Math.max(0, offsetDays - days))">
        <Icon name="chevronLeft" :size="14" />
      </button>
      <span class="muted range-text">{{ rangeLabel }}</span>
      <button type="button" class="mini-btn" @click="$emit('update:offset', offsetDays + days)">
        <Icon name="chevronRight" :size="14" />
      </button>
    </div>
    <svg :viewBox="`0 0 ${W} ${H}`" class="chart-svg" role="img" aria-label="打卡时段分布">
      <line v-for="h in [0, 6, 12, 18, 24]" :key="h" :x1="xOf(h)" :y1="TOP" :x2="xOf(h)" :y2="H" class="grid-line" />
      <text v-for="h in [0, 6, 12, 18, 24]" :key="'t' + h" :x="xOf(h)" :y="H - 4" class="axis-label" text-anchor="middle">{{ String(h).padStart(2, '0') }}:00</text>

      <template v-for="(day, di) in daysList" :key="day.ts">
        <text :x="LABEL_W - 6" :y="rowY(di) + 14" class="axis-label day-label" text-anchor="end">{{ day.label }}</text>
        <line :x1="LABEL_W" :y1="rowY(di) + 19" :x2="W" :y2="rowY(di) + 19" class="row-line" />
        <g v-for="(r, ri) in day.records" :key="ri">
          <rect
            v-if="barW(r) > 0.8"
            :x="xOf(startMin(r))"
            :y="rowY(di) + 4"
            :width="barW(r)"
            height="11"
            rx="2"
            class="gantt-bar"
          >
            <title>{{ r.title }}</title>
          </rect>
          <circle v-else :cx="xOf(startMin(r))" :cy="rowY(di) + 9.5" r="3" class="gantt-dot">
            <title>{{ r.title }}</title>
          </circle>
        </g>
      </template>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { store } from '../../../store.js'
import { indexCheckinRecords } from '../../../selectors.js'
import { startOfDayTs, addDaysTs, minuteOfDayTs, fmtDate, DAY_MS } from '../../../utils/date.js'
import { weekdayOf } from '../../../format.js'
import Icon from '../../ui/Icon.vue'

const props = defineProps({
  checkinId: { type: String, required: true },
  days: { type: Number, default: 14 },
  offsetDays: { type: Number, default: 0 },
})

defineEmits(['update:offset'])

const LABEL_W = 108
const ROW_H = 26
const TOP = 14
const HOUR_W = 100
const PLOT_W = 24 * HOUR_W
const W = LABEL_W + PLOT_W
const H = TOP + ROW_H * 14 + 18

const daysList = computed(() => {
  const today = startOfDayTs(Date.now())
  const from = today - (props.days + props.offsetDays - 1) * DAY_MS
  const map = indexCheckinRecords(store.state.checkinRecords, props.checkinId)
  const arr = []
  for (let i = 0; i < props.days; i += 1) {
    const day = addDaysTs(from, i)
    const recs = (map[fmtDate(day)] || []).slice().sort((a, b) => a.at - b.at)
    arr.push({
      ts: day,
      label: `${fmtDate(day)} ${weekdayOf(day)}`,
      records: recs.map((r) => {
        const d = new Date(r.at)
        const startMin = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
        const dur = r.durationMin || 0
        return {
          at: r.at,
          durationMin: dur,
          startMin,
          title: `${fmtDate(r.at)} ${new Date(r.at).toTimeString().slice(0, 8)} · ${dur ? dur + ' 分钟' : '1 次打卡'}`,
        }
      }),
    })
  }
  return arr
})

const rangeLabel = computed(() => {
  if (!daysList.value.length) return ''
  return `${fmtDate(daysList.value[0].ts)} ~ ${fmtDate(daysList.value[daysList.value.length - 1].ts)}`
})

function xOf(hour) {
  return LABEL_W + hour * HOUR_W
}

function rowY(i) {
  return TOP + i * ROW_H
}

function startMin(r) {
  return Math.max(0, Math.min(1440, r.startMin))
}

function barW(r) {
  if (!r.durationMin) return 0
  return Math.min((r.durationMin / 60) * HOUR_W, Math.max(0, W - xOf(r.startMin)))
}
</script>

<style scoped>
.chart-box {
  width: 100%;
  overflow-x: auto;
}

.chart-svg {
  min-width: 560px;
  width: 100%;
  height: auto;
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 6px;
}

.mini-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-dim);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mini-btn:disabled {
  opacity: 0.35;
}

.range-text {
  font-size: 12.5px;
}

.grid-line {
  stroke: var(--line);
  stroke-width: 1;
}

.row-line {
  stroke: var(--line);
  stroke-width: 0.8;
  stroke-dasharray: 3 4;
}

.axis-label {
  font-size: 10px;
  fill: var(--text-dim);
}

.day-label {
  font-size: 11px;
}

.gantt-bar {
  fill: color-mix(in srgb, var(--accent) 80%, transparent);
}

.gantt-dot {
  fill: var(--accent);
}
</style>
