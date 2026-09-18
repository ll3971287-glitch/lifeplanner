<template>
  <div class="bp-tl">
    <div class="col gap10 tl-wrap">
      <!-- 四个月视窗时间轴 -->
      <div class="view card">
        <div class="vp-toolbar row-between">
          <button type="button" class="vp-btn" title="往前四个月" @click="step(-1)">
            <Icon name="chevronLeft" :size="15" />
          </button>
          <div class="vp-title">
            <strong>{{ viewYear }} 年 {{ monthsRangeLabel }}</strong>
            <span class="muted mini">四个月视窗 · 左右拖动切换</span>
          </div>
          <button type="button" class="vp-btn" title="往后四个月" @click="step(1)">
            <Icon name="chevronRight" :size="15" />
          </button>
        </div>
        <div class="vp-hint row gap6">
          <button type="button" class="mini-btn" @click="goNow">回到当前</button>
          <span class="muted mini">进度条跨出视窗会在相邻视窗里继续显示</span>
        </div>

        <div class="vp-body" @pointerdown="startDrag" @pointermove="onDrag" @pointerup="endDrag" @pointercancel="endDrag">
          <div ref="gridRef" class="months-grid" :style="{ gridTemplateColumns: `repeat(${MONTHS_PER_VIEW}, minmax(0, 1fr))` }">
            <div v-for="m in months" :key="m.label" class="month-col">
              <span class="m-label">{{ m.label }}</span>
            </div>
          </div>
          <div class="lanes" :style="{ height: Math.max(60, lanesH) + 'px', backgroundSize: colW + 'px 100%' }">
            <div v-if="!rows.length" class="no-bar muted">这四个月内没有规划截止的蓝图</div>
            <div v-for="row in rows" :key="row.id" class="lane" :style="{ top: row.top + 'px', height: row.rowH + 'px' }">
              <div
                class="bar"
                :class="['st-' + row.status, 'lv-' + row.level]"
                :style="barStyle(row)"
                :title="row.title + '　' + row.rangeText + '　（' + levelLabelOf(row) + '）'"
                @click="emitOpen(row)"
              >
                <i class="dim-dot" :style="{ background: row.color }" />
                <span class="bar-title">{{ row.title }}</span>
                <span class="bar-sub">{{ row.dim }} · {{ statusOf(row.status).label }}</span>
              </div>
            </div>
          </div>
          <div class="now-line" v-if="nowInView" :style="{ left: nowPx + 'px' }" />
        </div>
      </div>

      <!-- 构想池：无期望达成时间 -->
      <div class="pool card">
        <div class="row-between">
          <h3 class="pool-head"><Icon name="flag" :size="13" /> 构想池</h3>
          <span class="muted mini pool-hint">未设达成时间的规划</span>
        </div>
        <div class="pool-list">
          <button v-for="b in pool" :key="b.id" type="button" class="pool-item" @click="$emit('open', b.id)">
            <i class="dim-dot" :style="{ background: colorOf(b) }" />
            <span class="pool-title">{{ b.title }}</span>
            <span v-if="b.goalText" class="muted mini">{{ b.goalText }}</span>
          </button>
          <p v-if="!pool.length" class="muted empty-pool">暂无</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { store } from '../../store.js'
import { goalStart, goalEnd, dimLabel, dimColor, BLUEPRINT_STATUS, levelOf, levelBarH, levelWeight, BLUEPRINT_LEVELS } from '../../blueprintMeta.js'
import { fmtDate } from '../../utils/date.js'
import Icon from '../ui/Icon.vue'

const props = defineProps({
  items: { type: Array, default: () => [] }, // 筛选后的全部蓝图（含无达成时间）
})
const emit = defineEmits(['open'])

const MW_MIN = 62 // 月刻度列宽下限（窄屏自适应时可能更小）
const ROW_PAD = 10 // 每行上下留白（条高由等级决定）
const statusOf = (k) => BLUEPRINT_STATUS[k] || BLUEPRINT_STATUS.idea

// —— 四个月视窗锚点（连续整数：year*3 + 第几块，每块 4 个月：1-4 / 5-8 / 9-12 月）
const MONTHS_PER_VIEW = 4
const cursor = ref(blockIdxOf(Date.now()))
function blockIdxOf(ts) {
  const d = new Date(ts)
  return d.getFullYear() * (12 / MONTHS_PER_VIEW) + Math.floor(d.getMonth() / MONTHS_PER_VIEW)
}
const viewYear = computed(() => Math.floor(cursor.value / (12 / MONTHS_PER_VIEW)))
const viewBlock = computed(() => cursor.value % (12 / MONTHS_PER_VIEW))
const blockStartMonth = computed(() => viewBlock.value * MONTHS_PER_VIEW)
const viewStart = computed(() => new Date(viewYear.value, blockStartMonth.value, 1).getTime())
const viewEnd = computed(() => new Date(viewYear.value, blockStartMonth.value + MONTHS_PER_VIEW, 1).getTime())

const months = computed(() => {
  const out = []
  for (let i = 0; i < MONTHS_PER_VIEW; i++) {
    const d = new Date(viewYear.value, blockStartMonth.value + i, 1)
    out.push({ label: `${d.getMonth() + 1}月`, ts: d.getTime() })
  }
  return out
})
const monthsRangeLabel = computed(() => `${months.value[0].label} ~ ${months.value[months.value.length - 1].label}`)

// —— 条目拆分：构想池（无终点）与时间轴
const timed = computed(() => props.items.filter((b) => goalEnd(b) != null))
const pool = computed(() => props.items.filter((b) => goalEnd(b) == null))

// x 坐标：视窗内按月刻度映射（月内按天比例）
// 列宽自适应：按容器宽度 / 4 计算，保证手机上 4 个月都能看到
const gridRef = ref(null)
const colW = ref(MW_MIN)
function measure() {
  const el = gridRef.value
  if (!el || !el.clientWidth) return
  colW.value = Math.max(MW_MIN, Math.floor(el.clientWidth / MONTHS_PER_VIEW))
}
onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => window.removeEventListener('resize', measure))

function pxOf(ts) {
  let x = 0
  for (const m of months.value) {
    const mEnd = new Date(m.ts).setMonth(new Date(m.ts).getMonth() + 1)
    if (ts < mEnd) {
      const frac = Math.min(0.9999, Math.max(0, (ts - m.ts) / (mEnd - m.ts)))
      return x + frac * colW.value // 月内按天比例映射到月刻度
    }
    x += colW.value
  }
  return x
}

const bars = computed(() => {
  const start = viewStart.value
  const end = viewEnd.value
  const out = []
  for (const b of timed.value) {
    const s = goalStart(b) || goalEnd(b)
    const e = goalEnd(b)
    if (e < start || s > end) continue // 与视窗无交集
    const x = Math.max(0, pxOf(Math.max(s, start)))
    const right = Math.min(MONTHS_PER_VIEW * colW.value, pxOf(Math.min(e, end)))
    const dim = b.dimension ? dimLabel(b.dimension, store.state.settings.blueprintDims) : '未分组'
    const rangeText = `${fmtDate(s)} ~ ${fmtDate(e)}`
    out.push({
      id: b.id,
      status: b.status,
      title: b.title,
      dim,
      level: levelOf(b),
      barH: levelBarH(b),
      weight: levelWeight(b),
      color: b.dimension ? dimColor(b.dimension, store.state.settings.blueprintDims) : '#9ca3af',
      x,
      w: right - x,
      rangeText,
    })
  }
  // 大蓝图在上（视觉大小 + 顺序双重区分优先级），同级按时间先后
  return out.sort((a, b) => b.weight - a.weight || a.x - b.x)
})

// 行布局：每行高度 = 该行条高 + 留白，逐行累加定位
const rows = computed(() => {
  let top = 0
  return bars.value.map((bar) => {
    const rowH = bar.barH + ROW_PAD
    const row = { ...bar, top, rowH, barTop: Math.round(ROW_PAD / 2) }
    top += rowH
    return row
  })
})
const lanesH = computed(() => (rows.value.length ? rows.value[rows.value.length - 1].top + rows.value[rows.value.length - 1].rowH : 60))

// 单日条宽下限：结束于该月首日的按整天算
const nowTs = computed(() => Date.now())
const nowInView = computed(() => nowTs.value >= viewStart.value && nowTs.value < viewEnd.value)
const nowPx = computed(() => pxOf(nowTs.value))

// —— 拖拽切换视窗
const vpDrag = { x: 0, moved: 0 }
function startDrag(e) {
  vpDrag.x = e.clientX
  vpDrag.moved = 0
}
function onDrag(e) {
  if (vpDrag.x == null) return
  const dx = e.clientX - vpDrag.x
  vpDrag.moved = Math.max(vpDrag.moved, Math.abs(dx))
  if (vpDrag.moved > 46) {
    const dir = dx > 0 ? -1 : 1
    cursor.value += dir
    vpDrag.x = e.clientX
    vpDrag.moved = 0
  }
  e.preventDefault()
}
function endDrag() {
  vpDrag.x = null
}
function step(dir) {
  cursor.value += dir
}
function goNow() {
  cursor.value = blockIdxOf(Date.now())
}
function emitOpen(bar) {
  if (vpDrag.moved > 8) return
  emit('open', bar.id)
}
// 进度条颜色按「人生维度」着色（状态只体现为透明度/线型）
function barStyle(row) {
  return {
    left: row.x + 'px',
    width: Math.max(row.w, 26) + 'px',
    height: row.barH + 'px',
    top: row.barTop + 'px',
    background: `color-mix(in srgb, ${row.color} 34%, transparent)`,
    borderColor: row.color,
  }
}
function levelLabelOf(row) {
  return (BLUEPRINT_LEVELS[row.level] || BLUEPRINT_LEVELS.small).label
}
function colorOf(b) {
  return b.dimension ? dimColor(b.dimension, store.state.settings.blueprintDims) : '#9ca3af'
}

</script>

<style scoped>
.bp-tl {
  width: 100%;
}

.tl-wrap {
  align-items: stretch;
}

.pool {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pool-head {
  margin: 0;
  font-size: 13.5px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pool-hint {
  margin: 0;
  font-size: 11px;
}

.pool-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pool-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 260px;
  text-align: left;
  padding: 6px 11px;
  border-radius: 999px;
  border: 1px dashed var(--line);
  background: var(--panel);
}

.pool-title {
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-pool {
  margin: 0;
  text-align: center;
  font-size: 12px;
  padding: 4px 0;
}

.view {
  flex: 1;
  min-width: 0;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.vp-toolbar {
  align-items: center;
}

.vp-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  font-size: 14px;
}

.vp-btn {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--text);
  display: grid;
  place-items: center;
}

.vp-btn:active {
  transform: scale(0.94);
}

.vp-hint {
  align-items: center;
}

.mini-btn {
  font-size: 11.5px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--muted);
}

.vp-body {
  position: relative;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.vp-body:active {
  cursor: grabbing;
}

.months-grid {
  display: grid;

  border: 1px solid var(--line);
  border-bottom: none;
  background: color-mix(in srgb, var(--line) 45%, transparent);
}

.month-col {
  border-right: 1px solid var(--line);
  text-align: center;
  padding: 5px 0;
}

.month-col:last-child {
  border-right: none;
}

.m-label {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-dim);
}

.lanes {
  position: relative;
  border: 1px solid var(--line);
  overflow: hidden;
  background-image: repeating-linear-gradient(
    to right,
    color-mix(in srgb, var(--line) 30%, transparent) 0 1px,
    transparent 1px
  );
  background-color: var(--card);
  background-repeat: repeat-x;
}

.no-bar {
  padding: 14px;
  font-size: 12.5px;
  text-align: center;
}

.lane {
  position: absolute;
  left: 0;
  right: 0;
  border-bottom: 1px dashed var(--line);
}

.bar {
  position: absolute;
  border-radius: 9px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
  overflow: hidden;
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
}

.bar.st-paused {
  opacity: 0.5;
  border-style: dashed;
}

.bar.st-done {
  opacity: 0.75;
}

.bar.st-done .bar-title {
  text-decoration: line-through;
}

.bar .dim-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}

.bar.lv-small {
  border-radius: 8px;
  padding: 0 8px;
}

.bar.lv-small .bar-sub {
  display: none;
}

.bar.lv-medium .bar-title {
  font-size: 12.5px;
}

.bar.lv-large {
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
}

.bar.lv-large .bar-title {
  font-size: 13.5px;
  font-weight: 800;
}

.bar-title {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-sub {
  font-size: 10.5px;
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.now-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--warn);
  pointer-events: none;
}
</style>
