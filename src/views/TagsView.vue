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

    <p v-if="store.state.tags.length > 1" class="muted reorder-tip">长按标签卡片可拖动调整顺序</p>
    <div ref="gridRef" class="tag-grid" :class="{ sorting: reorderMode }">
      <template v-for="(tg, idx) in store.state.tags" :key="tg.id">
        <span v-if="slotBefore(tg.id)" class="drop-slot" />
        <button
          type="button"
          class="tag-card card"
          :class="{ 'is-drag': reorderMode && draggingId === tg.id }"
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
    <p v-if="reorderMode" class="muted sort-hint">松开落位 · 其它标签不移动</p>
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
const CARD_H = 78
let downX = 0
let downY = 0
let downIdx = -1
let timer = null
let ignoreClick = false

const visibleIds = computed(() => store.state.tags.map((t) => t.id).filter((id) => id !== draggingId.value))

function cardStyle(tg) {
  if (reorderMode.value && draggingId.value === tg.id) {
    return { transform: `translate(${dragX.value}px, ${dragY.value}px)`, transition: 'none', zIndex: 3, position: 'relative' }
  }
  return undefined
}
function slotBefore(id) {
  if (!reorderMode.value) return false
  const i = visibleIds.value.indexOf(id)
  return i >= 0 && dropIdx.value === i
}

function onCardDown(tg, idx, e) {
  downIdx = idx
  downX = e.clientX
  downY = e.clientY
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

function onMove(e) {
  if (!reorderMode.value || draggingId.value == null) return
  e.preventDefault()
  dragX.value = e.clientX - downX
  dragY.value = e.clientY - downY
  const grid = gridRef.value
  const card = grid && grid.querySelector('.tag-card')
  const cardW = (card && card.offsetWidth) || CARD_W
  const cardH = (card && card.offsetHeight) || CARD_H
  const perRow = Math.max(1, Math.floor(((grid && grid.offsetWidth) || cardW * 3) / cardW))
  const stepX = Math.round(dragX.value / cardW)
  const stepY = Math.round(dragY.value / cardH) * perRow
  dropIdx.value = Math.max(0, Math.min(visibleIds.value.length, downIdx + stepX + stepY))
}

function onUp() {
  clearTimeout(timer)
  if (reorderMode.value && draggingId.value != null) {
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
  }, 0)
}

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
  width: 12px;
  border-radius: 10px;
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

.tag-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 11px;
}

.tag-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 16px 14px;
  cursor: pointer;
  text-align: left;
  transition: transform 0.1s ease;
}

.tag-card:active {
  transform: scale(0.97);
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
