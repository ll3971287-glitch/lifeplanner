<template>
  <div class="chart-box">
    <svg :viewBox="`0 0 ${W} ${H}`" class="chart-svg" role="img" aria-label="打卡热力图">
      <text x="0" y="10" class="axis-label">最近 52 周 · 颜色越深完成越多</text>
      <g v-for="day in cells" :key="day.key">
        <rect :x="day.x" :y="day.y" width="13" height="13" rx="2" :style="day.fill">
          <title>{{ day.title }}</title>
        </rect>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { store } from '../../../store.js'
import { indexCheckinRecords, dayRecordStats, checkinDayMet } from '../../../selectors.js'
import { startOfWeekTs, startOfDayTs, addDaysTs, DAY_MS, fmtDate } from '../../../utils/date.js'

const props = defineProps({
  checkinId: { type: String, required: true },
})

const CELL = 15
const COLS = 52
const ROWS = 7
const PAD_X = 2
const PAD_Y = 22
const W = COLS * CELL + PAD_X * 2
const H = ROWS * CELL + PAD_Y

const rows = computed(() => {
  const today = startOfDayTs(Date.now())
  const weekStart = startOfWeekTs(today)
  const firstWeekStart = weekStart - (COLS - 1) * 7 * DAY_MS
  return Array.from({ length: COLS }, (_, c) =>
    Array.from({ length: ROWS }, (_, r) => addDaysTs(firstWeekStart, c * 7 + r))
  )
})

const cells = computed(() => {
  const c = store.state.checkins.find((x) => x.id === props.checkinId)
  if (!c) return []
  const map = indexCheckinRecords(store.state.checkinRecords, props.checkinId)
  const out = []
  const now = Date.now()
  rows.value.forEach((week, cIdx) => {
    week.forEach((day, rIdx) => {
      const st = dayRecordStats(map, day)
      const met = checkinDayMet(c, map, day)
      const future = day > startOfDayTs(now)
      let fill = 'fill: var(--line)'
      if (!future) {
        if (met) {
          const ratio = c.dailyTargetCount ? Math.min(1, st.counts / c.dailyTargetCount) : 1
          fill = `fill: ${metColor(ratio)}`
        } else if (st.counts > 0) {
          fill = 'fill: var(--warn); opacity: 0.55'
        }
      }
      out.push({
        key: `${cIdx}-${rIdx}`,
        x: PAD_X + cIdx * CELL,
        y: PAD_Y + rIdx * CELL,
        fill,
        title: `${fmtDate(day)}：${st.counts} ${c.unit}${met ? '，达标' : ''}`,
      })
    })
  })
  return out
})

function metColor(ratio) {
  if (ratio >= 1) return 'var(--primary-deep)'
  if (ratio >= 0.5) return 'var(--primary)'
  return 'color-mix(in srgb, var(--primary) 55%, transparent)'
}
</script>

<style scoped>
.chart-box {
  width: 100%;
  overflow-x: auto;
}

.chart-svg {
  min-width: 480px;
  width: 100%;
  height: auto;
}

.axis-label {
  font-size: 10px;
  fill: var(--text-dim);
}
</style>
