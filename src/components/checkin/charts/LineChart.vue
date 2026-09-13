<template>
  <div class="chart-box">
    <svg :viewBox="`0 0 ${W} ${H}`" class="chart-svg" role="img" :aria-label="`${days} 天打卡趋势`">
      <g v-for="(l, li) in xLabels" :key="li">
        <line :x1="l.x" :y1="PT" :x2="l.x" :y2="H - PB" class="grid-line" />
        <text :x="l.x" :y="H - 12" class="axis-label" text-anchor="middle">{{ l.text }}</text>
      </g>
      <g v-for="(l, li) in yLabels" :key="'y' + li">
        <line :x1="PL" :y1="l.y" :x2="W - PR" :y2="l.y" class="grid-line" />
        <text :x="PL - 6" :y="l.y + 4" class="axis-label" text-anchor="end">{{ l.text }}</text>
      </g>

      <rect
        v-for="(b, i) in bars"
        :key="'b' + i"
        :x="b.x"
        :y="b.y"
        :width="b.w"
        :height="b.h"
        class="bar"
      >
        <title>{{ b.title }}</title>
      </rect>

      <polyline v-if="linePoints.length > 1" :points="linePoints" class="line" fill="none" />
      <circle v-for="(p, i) in lineDots" :key="'d' + i" :cx="p.x" :cy="p.y" r="2.6" class="dot">
        <title>{{ p.title }}</title>
      </circle>
    </svg>
    <div class="legend muted">
      <span class="legend-item"><i class="sw bar-s" /> 次数</span>
      <span class="legend-item"><i class="sw line-s" /> 时长（分钟）</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { store } from '../../../store.js'
import { indexCheckinRecords, chartDailySeries } from '../../../selectors.js'
import { startOfDayTs, DAY_MS } from '../../../utils/date.js'
import { fmtDate } from '../../../utils/date.js'

const props = defineProps({
  checkinId: { type: String, required: true },
  days: { type: Number, default: 30 },
})

const W = 640
const H = 250
const PL = 40
const PR = 14
const PT = 16
const PB = 30

const series = computed(() => {
  const c = store.state.checkins.find((x) => x.id === props.checkinId)
  if (!c) return []
  const map = indexCheckinRecords(store.state.checkinRecords, props.checkinId)
  const endDay = startOfDayTs(Date.now())
  const fromDay = endDay - (props.days - 1) * DAY_MS
  return chartDailySeries(map, fromDay, props.days)
})

const plotW = W - PL - PR
const plotH = H - PT - PB
const maxC = computed(() => Math.max(1, ...series.value.map((s) => s.counts)))
const maxD = computed(() => Math.max(1, ...series.value.map((s) => s.duration)))
const n = computed(() => Math.max(1, series.value.length))
const stepX = computed(() => plotW / n.value)

const bars = computed(() =>
  series.value.map((s, i) => {
    const x = PL + i * stepX.value + 1
    const h = (s.counts / maxC.value) * (plotH - 8)
    return { x, y: PT + plotH - h, w: Math.max(2, stepX.value * 0.55), h, title: `${fmtDate(s.ts)}：${s.counts} 次 / ${s.duration} 分钟` }
  })
)

const linePoints = computed(() =>
  series.value
    .map((s, i) => {
      const x = PL + i * stepX.value + stepX.value / 2
      const y = PT + plotH - (s.duration / maxD.value) * (plotH - 8)
      return `${x},${y}`
    })
    .join(' ')
)

const lineDots = computed(() =>
  series.value.map((s, i) => {
    const x = PL + i * stepX.value + stepX.value / 2
    const y = PT + plotH - (s.duration / maxD.value) * (plotH - 8)
    return { x, y, title: `${fmtDate(s.ts)}：${s.duration} 分钟` }
  })
)

const xLabels = computed(() => {
  const every = Math.ceil(n.value / 6)
  const out = []
  series.value.forEach((s, i) => {
    if (i % every === 0 || i === n.value - 1) {
      const d = new Date(s.ts)
      out.push({ x: PL + i * stepX.value, text: `${d.getMonth() + 1}/${d.getDate()}` })
    }
  })
  return out
})

const yLabels = computed(() => {
  const out = []
  for (let v = 0; v <= 4; v += 1) {
    const val = Math.round((maxC.value * v) / 4)
    out.push({ y: PT + plotH - (v / 4) * plotH, text: String(val) })
  }
  return out
})
</script>

<style scoped>
.chart-box {
  width: 100%;
}

.chart-svg {
  width: 100%;
  height: auto;
}

.grid-line {
  stroke: var(--line);
  stroke-width: 1;
}

.axis-label {
  font-size: 10px;
  fill: var(--text-dim);
}

.bar {
  fill: color-mix(in srgb, var(--primary-deep) 78%, transparent);
}

.line {
  stroke: var(--accent);
  stroke-width: 2;
}

.dot {
  fill: var(--accent);
}

.legend {
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  font-size: 12px;
  padding: 4px 6px 0;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.sw {
  width: 12px;
  height: 4px;
  border-radius: 2px;
  display: inline-block;
}

.bar-s {
  background: color-mix(in srgb, var(--primary-deep) 78%, transparent);
}

.line-s {
  background: var(--accent);
}
</style>
