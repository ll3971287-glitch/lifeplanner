<template>
  <div class="chart-box">
    <div class="hm-head">
      <button type="button" class="mini-btn" :disabled="!canPrev" aria-label="上一期" @click="shiftHalf(-1)">
        <Icon name="chevronLeft" :size="14" />
      </button>
      <div class="hm-title">
        <strong>{{ title }}</strong>
        <span class="muted hm-hint">{{ rangeText }} · 达标 {{ metCount }} 天</span>
      </div>
      <button type="button" class="mini-btn" :disabled="!canNext" aria-label="下一期" @click="shiftHalf(1)">
        <Icon name="chevronRight" :size="14" />
      </button>
    </div>

    <svg :viewBox="`0 0 ${totalW} ${H}`" class="chart-svg" role="img" :aria-label="`${title}打卡热力图`">
      <text v-for="m in monthMarks" :key="m.label" :x="m.x" :y="10" class="axis-label">{{ m.label }}</text>
      <text v-for="w in weekMarks" :key="w.label" :x="LEFT - 5" :y="w.y" class="axis-label" text-anchor="end">{{ w.label }}</text>
      <g v-for="day in cells" :key="day.key">
        <rect
          :x="day.x"
          :y="day.y"
          width="13"
          height="13"
          rx="2"
          class="hm-cell"
          :class="{ focus: day.focus }"
          :style="day.fill"
        >
          <title>{{ day.title }}</title>
        </rect>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { store } from '../../../store.js'
import { indexCheckinRecords, dayRecordStats, checkinDayMet } from '../../../selectors.js'
import { startOfWeekTs, startOfDayTs, addDaysTs, DAY_MS, fmtDate, isSameDayTs } from '../../../utils/date.js'
import Icon from '../../ui/Icon.vue'

const props = defineProps({
  checkinId: { type: String, required: true },
  // 传入某天时间戳时，自动定位到该日期所在的半年分区并高亮
  focusTs: { type: Number, default: null },
})

const CELL = 15
const ROWS = 7
const LEFT = 18
const TOP = 20
const H = TOP + ROWS * CELL + 4

const checkin = computed(() => store.state.checkins.find((x) => x.id === props.checkinId) || null)
const map = computed(() => indexCheckinRecords(store.state.checkinRecords, props.checkinId))

function halfOf(ts) {
  const d = new Date(ts)
  return { year: d.getFullYear(), half: d.getMonth() < 6 ? 0 : 1 }
}

function halfStartTs(year, half) {
  return new Date(year, half * 6, 1).getTime()
}

function halfEndTs(year, half) {
  // 该半年最后一刻（下个半年首日前一天）
  return new Date(year, half * 6 + 6, 1).getTime() - DAY_MS
}

// 可浏览范围：最早记录/开始日期所在半年 ~ 今天所在半年
const bounds = computed(() => {
  const c = checkin.value
  const starts = []
  if (c && c.startDate != null) starts.push(startOfDayTs(c.startDate))
  const recs = (store.state.checkinRecords || []).filter((r) => r.checkinId === props.checkinId)
  if (recs.length) starts.push(startOfDayTs(Math.min(...recs.map((r) => r.at))))
  const firstTs = starts.length ? Math.min(...starts) : startOfDayTs(Date.now())
  const first = halfOf(Math.min(firstTs, startOfDayTs(Date.now())))
  return { min: first, max: halfOf(startOfDayTs(Date.now())) }
})

const cursor = ref(halfOf(props.focusTs != null ? props.focusTs : startOfDayTs(Date.now())))

const order = (h) => h.year * 2 + h.half
const canPrev = computed(() => order(cursor.value) > order(bounds.value.min))
const canNext = computed(() => order(cursor.value) < order(bounds.value.max))

function shiftHalf(delta) {
  const target = order(cursor.value) + delta
  if (target < order(bounds.value.min) || target > order(bounds.value.max)) return
  cursor.value = { year: Math.floor(target / 2), half: target % 2 }
}

// 外部传入日期 → 定位到对应半年
watch(
  () => props.focusTs,
  (ts) => {
    if (ts == null) return
    const h = halfOf(ts)
    cursor.value = {
      year: Math.min(Math.max(h.year, bounds.value.min.year), bounds.value.max.year),
      half: h.half,
    }
  },
  { immediate: true }
)

const title = computed(() => `${cursor.value.year} 年${cursor.value.half === 0 ? '上半年' : '下半年'}`)

const rangeText = computed(() => {
  const s = halfStartTs(cursor.value.year, cursor.value.half)
  const e = halfEndTs(cursor.value.year, cursor.value.half)
  const fmt = (ts) => {
    const d = new Date(ts)
    return `${d.getMonth() + 1} 月`
  }
  return `${fmt(s)} – ${fmt(e)}`
})

// 该半年的周列（周一起）
const weekStarts = computed(() => {
  const s = startOfDayTs(halfStartTs(cursor.value.year, cursor.value.half))
  const e = startOfDayTs(halfEndTs(cursor.value.year, cursor.value.half))
  const first = startOfWeekTs(s)
  const list = []
  for (let t = first; t <= e; t += 7 * DAY_MS) list.push(t)
  return list
})

const cols = computed(() => weekStarts.value.length)
const totalW = computed(() => LEFT + cols.value * CELL + 4)

const monthMarks = computed(() =>
  weekStarts.value
    .map((weekTs, idx) => ({ idx, d: new Date(weekTs) }))
    .filter(({ d }, i, arr) => i === 0 || d.getMonth() !== arr[i - 1].d.getMonth())
    .map(({ idx, d }) => ({ label: `${d.getMonth() + 1} 月`, x: LEFT + idx * CELL }))
)

const weekMarks = computed(() =>
  [0, 2, 4, 6].map((r) => ({ label: ['一', '三', '五', '日'][r / 2], y: TOP + r * CELL + 11 }))
)

const cells = computed(() => {
  const c = checkin.value
  if (!c) return []
  const s = startOfDayTs(halfStartTs(cursor.value.year, cursor.value.half))
  const e = startOfDayTs(halfEndTs(cursor.value.year, cursor.value.half))
  const today = startOfDayTs(Date.now())
  const out = []
  weekStarts.value.forEach((weekTs, cIdx) => {
    for (let r = 0; r < ROWS; r += 1) {
      const day = addDaysTs(weekTs, r)
      if (day < s || day > e) continue
      const st = dayRecordStats(map.value, day)
      const met = checkinDayMet(c, map.value, day)
      const future = day > today
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
        key: `${cIdx}-${r}`,
        x: LEFT + cIdx * CELL,
        y: TOP + r * CELL,
        fill,
        focus: props.focusTs != null && isSameDayTs(day, props.focusTs),
        title: `${fmtDate(day)}：${st.counts} ${c.unit}${met ? '，达标' : ''}`,
      })
    }
  })
  return out
})

const metCount = computed(() => {
  const c = checkin.value
  if (!c) return 0
  const s = startOfDayTs(halfStartTs(cursor.value.year, cursor.value.half))
  const e = startOfDayTs(halfEndTs(cursor.value.year, cursor.value.half))
  const today = startOfDayTs(Date.now())
  let n = 0
  for (let day = s; day <= e && day <= today; day = addDaysTs(day, 1)) {
    if (checkinDayMet(c, map.value, day)) n += 1
  }
  return n
})

function metColor(ratio) {
  if (ratio >= 1) return 'var(--primary-deep)'
  if (ratio >= 0.5) return 'var(--primary)'
  return 'color-mix(in srgb, var(--primary) 55%, transparent)'
}

defineExpose({ shiftHalf })
</script>

<style scoped>
.chart-box {
  width: 100%;
  overflow-x: auto;
}

.hm-head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 6px;
}

.hm-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.3;
}

.hm-hint {
  font-size: 11.5px;
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
  flex: none;
}

.mini-btn:disabled {
  opacity: 0.35;
}

.chart-svg {
  min-width: 420px;
  width: 100%;
  height: auto;
}

.axis-label {
  font-size: 10px;
  fill: var(--text-dim);
}

.hm-cell.focus {
  stroke: var(--accent-deep);
  stroke-width: 1.6;
}
</style>
