<template>
  <div class="tags-view">
    <div class="toolbar card">
      <div class="row-between gap8 wrap">
        <div>
          <h2 class="page-title">标签</h2>
          <p class="muted title-sub">给任务和项目分类，点开看全部关联</p>
        </div>
        <button type="button" class="btn btn-primary" @click="openCreate">
          <Icon name="plus" :size="16" /> 新建标签
        </button>
      </div>
    </div>

    <p v-if="store.state.tags.length > 1" class="muted reorder-tip">长按标签可上下拖动调整顺序</p>
    <div ref="gridRef" class="tag-grid" :class="{ sorting: reorderMode }">
      <template v-for="(tg, idx) in store.state.tags" :key="tg.id">
        <span v-if="slotBefore(tg.id)" class="drop-slot" />
        <span v-if="reorderMode && draggingId === tg.id" class="ghost-slot" :style="ghostStyle" />
        <button
          type="button"
          class="tag-card card"
          :class="[{ 'is-drag': reorderMode && draggingId === tg.id }, landedClass(tg)]"
          :style="cardStyle(tg)"
          @click="openTag(tg)"
          @pointerdown="onCardDown(tg, idx, $event)"
        >
          <span class="tag-dot" :style="{ background: tg.color }" />
          <span class="tag-name">{{ tg.name }}</span>
          <span class="tag-count muted">{{ totalOf(tg.id) }} 项关联</span>
        </button>
      </template>
      <span v-if="reorderMode && dropIdx === visibleIds.length" class="drop-slot" />
    </div>
    <p v-if="reorderMode" class="muted sort-hint">松开落位 · 其余标签不移动</p>
    <EmptyState v-else icon="tag" text="还没有标签" hint="标签可以把不同模块的内容串起来">
      <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="openCreate">
        <Icon name="plus" :size="16" /> 创建第一个标签
      </button>
    </EmptyState>

    <BaseModal :open="form.open" title="新建标签" @close="form.open = false">
      <TagFormModal v-if="form.open" @close="form.open = false" @saved="form.open = false" />
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../store.js'
import { tagCounts } from '../selectors.js'
import Icon from '../components/ui/Icon.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import TagFormModal from '../components/tag/TagFormModal.vue'

const router = useRouter()

const form = ref({ open: false })

// —— 长按拖拽排序（拖动者跟手，其余卡片不移动，落位槽指示）
const gridRef = ref(null)
const reorderMode = ref(false)
const draggingId = ref(null)
const dragX = ref(0)
const dragY = ref(0)
const dropIdx = ref(-1)
const CARD_W = 150
const CARD_H = 56
let downX = 0
let downY = 0
let downIdx = -1
let dragRect = { left: 0, top: 0, width: 240, height: 56 }
let landedId = null
let timer = null
let ignoreClick = false

const visibleIds = computed(() => store.state.tags.map((t) => t.id).filter((id) => id !== draggingId.value))

// 拖动中的卡片：真正“悬浮”起来（fixed 脱离列表 + 跟手位移 + 抬高层级）
function cardStyle(tg) {
  if (reorderMode.value && draggingId.value === tg.id) {
    const r = dragRect
    return {
      position: 'fixed',
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width || 240}px`,
      transform: `translate(${dragX.value}px, ${dragY.value}px) scale(1.02)`,
      transition: 'none',
      zIndex: 30,
      pointerEvents: 'none',
    }
  }
  return undefined
}

// 原位置占位（保持列表高度，避免其它标签跳动）
const ghostStyle = computed(() => ({ height: `${dragRect.height || CARD_H}px` }))
function slotBefore(id) {
  if (!reorderMode.value) return false
  const i = visibleIds.value.indexOf(id)
  return i >= 0 && dropIdx.value === i
}

function onCardDown(tg, idx, e) {
  downIdx = idx
  downX = e.clientX
  downY = e.clientY
  const el = e.currentTarget || e.target
  if (el && typeof el.getBoundingClientRect === 'function') {
    const r = el.getBoundingClientRect()
    dragRect = { left: r.left, top: r.top, width: r.width, height: r.height }
  }
  draggingId.value = tg.id
  dragX.value = 0
  dragY.value = 0
  dropIdx.value = idx
  clearTimeout(timer)
  timer = setTimeout(() => {
    reorderMode.value = true
    ignoreClick = true
  }, 420)
}

// 命中检测：指针落在哪张卡片上 → 插到该卡片「后方」（返回剔除被拖卡片后的插入索引）
// 布局不可用（如无头环境 rect 全 0）时返回 null，调用方回退为位移估算
function hitIndex(clientX, clientY) {
  const grid = gridRef.value
  if (!grid) return null
  const cards = [...grid.querySelectorAll('.tag-card:not(.is-drag)')]
  if (!cards.length) return null
  const rects = cards.map((c) => c.getBoundingClientRect())
  if (!rects.some((r) => r.width > 0 && r.height > 0)) return null
  // 1) 指针正在某张卡片内 → 插到它之后
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i]
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return i + 1
  }
  // 2) 指针在空白处 → 就近卡片，按其上下半区决定「之前 / 之后」
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i]
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const d = (clientX - cx) * (clientX - cx) + (clientY - cy) * (clientY - cy)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  if (best < 0) return null
  const r = rects[best]
  return clientY > r.top + r.height / 2 ? best + 1 : best
}

function onMove(e) {
  if (!reorderMode.value || draggingId.value == null) return
  e.preventDefault()
  dragX.value = e.clientX - downX
  dragY.value = e.clientY - downY
  const total = visibleIds.value.length
  // 优先用命中检测（插到任意目标卡片后方），不可用时回退为位移估算
  const hit = hitIndex(e.clientX, e.clientY)
  if (hit != null) {
    dropIdx.value = Math.max(0, Math.min(total, hit))
    return
  }
  const grid = gridRef.value
  const card = grid && grid.querySelector('.tag-card')
  const cardW = (card && card.offsetWidth) || CARD_W
  const cardH = (card && card.offsetHeight) || CARD_H
  const perRow = Math.max(1, Math.floor(((grid && grid.offsetWidth) || cardW * 3) / cardW))
  const stepX = Math.round(dragX.value / cardW)
  const stepY = Math.round(dragY.value / cardH) * perRow
  dropIdx.value = Math.max(0, Math.min(total, downIdx + stepX + stepY))
}

function onUp() {
  clearTimeout(timer)
  if (reorderMode.value && draggingId.value != null) {
    landedId = draggingId.value
    const ids = [...visibleIds.value]
    const insertAt = Math.max(0, Math.min(ids.length, dropIdx.value))
    ids.splice(insertAt, 0, draggingId.value)
    store.reorderTags(ids)
  }
  reorderMode.value = false
  draggingId.value = null
  dragX.value = 0
  dragY.value = 0
  dropIdx.value = -1
  downIdx = -1
  setTimeout(() => {
    ignoreClick = false
    landedId = null
  }, 220)
}

// 落地动画标记
const landedClass = (tg) => (landedId === tg.id ? 'just-landed' : '')

function openTag(tg) {
  if (ignoreClick || reorderMode.value) return
  router.push(`/tags/${tg.id}`)
}

onMounted(() => {
  window.addEventListener('pointermove', onMove, { passive: false })
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
})

const counts = computed(() => tagCounts(store.state))

function totalOf(id) {
  const c = counts.value[id]
  return c ? c.todo + c.project + c.sub : 0
}

function openCreate() {
  form.value = { open: true }
}
</script>

<style scoped>
.tags-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  padding: 14px;
}

.page-title {
  margin: 0;
  font-size: 18px;
}

.title-sub {
  margin: 2px 0 0;
}

.reorder-tip {
  margin: 0;
  font-size: 12px;
}

.sort-hint {
  margin: 4px 0 0;
  font-size: 12px;
}

.drop-slot {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--accent);
  animation: pulse 0.9s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

.tag-grid.sorting .tag-card:not(.is-drag) {
  transition: transform 0.15s ease;
}

/* 悬浮中的卡片：抬起阴影与层级 */
.tag-card.is-drag {
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--accent);
  cursor: grabbing;
  opacity: 0.98;
}

/* 原位置占位 */
.ghost-slot {
  width: 100%;
  border-radius: var(--radius);
  border: 1px dashed var(--line);
  background: color-mix(in srgb, var(--line) 30%, transparent);
}

/* 松手落地动画 */
.tag-card.just-landed {
  animation: drop-in 0.22s ease;
}

@keyframes drop-in {
  0% {
    transform: scale(1.02);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.tag-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tag-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  cursor: pointer;
  touch-action: pan-y;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  text-align: left;
  transition: transform 0.1s ease;
}

.tag-card:active {
  transform: scale(0.97);
}

.tag-card .tag-name {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 700;
}

.tag-card .tag-count {
  margin-left: auto;
  font-size: 12px;
}

.tag-card .tag-dot {
  width: 10px;
  height: 10px;
}

.tag-dot {
  width: 34px;
  height: 34px;
  border-radius: 10px;
}

.tag-name {
  font-size: 16px;
  font-weight: 700;
}

.tag-count {
  font-size: 12.5px;
}
</style>
