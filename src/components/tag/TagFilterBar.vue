<template>
  <div class="tag-bar">
    <div ref="barRef" class="bar-scroll">
      <button type="button" class="tag-chip" :class="{ on: modelValue === '' }" @click="pick('')">全部</button>
      <button
        type="button"
        class="tag-chip inbox"
        :class="{ on: modelValue === '__none' }"
        @click="pick(modelValue === '__none' ? '' : '__none')"
      >
        <Icon name="box" :size="12" /> 收集箱 {{ noTagCount }}
      </button>

      <template v-for="(tg, idx) in list" :key="tg.id">
        <span v-if="slotBefore(tg.id)" class="drop-slot" />
        <button
          type="button"
          class="tag-chip"
          :class="{ on: modelValue === tg.id, 'is-drag': reorderMode && draggingId === tg.id }"
          :style="chipStyle(tg.id)"
          @click="onChipClick(tg)"
          @pointerdown="onChipDown(tg, idx, $event)"
        >
          <i class="tag-dot" :style="{ background: tg.color }" />
          <span class="tag-name">{{ tg.name }}</span>
          <span class="tag-count">{{ countOf(tg.id) }}</span>
        </button>
      </template>
      <span v-if="reorderMode && dropIdx === visibleIds.length" class="drop-slot" />
      <span v-if="reorderMode" class="sort-hint">松开落位 · 其它标签不移动</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Icon from '../ui/Icon.vue'
import { store } from '../../store.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  counts: { type: Object, default: () => ({}) },
  noTagCount: { type: Number, default: 0 },
})
const emit = defineEmits(['update:modelValue', 'reorder'])

const list = computed(() => store.state.tags)
const barRef = ref(null)

function countOf(id) {
  return props.counts[id] || 0
}
function chipStyle(id) {
  const tg = list.value.find((t) => t.id === id)
  const style = {}
  if (tg && props.modelValue === id) {
    style.background = tg.color
    style.borderColor = tg.color
    style.color = '#fff'
  }
  // 拖动中的标签跟手移动
  if (reorderMode.value && draggingId.value === id) style.transform = `translateX(${dragX.value}px)`
  return style
}

// —— 点击选中
let ignoreClick = false
function pick(v) {
  emit('update:modelValue', v)
}
function onChipClick(tg) {
  if (ignoreClick) {
    ignoreClick = false
    return
  }
  if (reorderMode.value) return
  emit('update:modelValue', props.modelValue === tg.id ? '' : tg.id)
}

// —— 长按拖拽排序（拖动者跟手，其余标签不移动，落位槽指示）
const reorderMode = ref(false)
const draggingId = ref(null)
const dragX = ref(0)
const dropIdx = ref(-1)
let downX = 0
let downIdx = -1
let timer = null

function onChipDown(tg, idx, e) {
  downIdx = idx
  downX = e.clientX
  draggingId.value = tg.id
  dragX.value = 0
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
  const el = e.target
  const chipW = (el && el.offsetWidth) || 80
  const step = Math.round(dragX.value / chipW)
  // 目标插入索引（基于剔除被拖标签后的列表）
  dropIdx.value = Math.max(0, Math.min(visibleIds.value.length, downIdx + step))
}

// 剔除被拖标签后的可见顺序（落位索引基于这个列表）
const visibleIds = computed(() => list.value.map((t) => t.id).filter((id) => id !== draggingId.value))

// 落位槽是否显示在某个标签之前
function slotBefore(id) {
  if (!reorderMode.value) return false
  const i = visibleIds.value.indexOf(id)
  return i >= 0 && dropIdx.value === i
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
  dropIdx.value = -1
  downIdx = -1
  setTimeout(() => {
    ignoreClick = false
  }, 0)
}

// 拖拽监听常驻（仅排序模式生效），避免手势移出容器后丢失
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
</script>

<script>
export default { name: 'TagFilterBar' }
</script>

<style scoped>
.tag-bar {
  width: 100%;
}

.bar-scroll {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 0 4px;
  scrollbar-width: none;
}

.bar-scroll::-webkit-scrollbar {
  display: none;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--muted);
  font-size: 12.5px;
  touch-action: pan-y;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.tag-chip.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--text);
  font-weight: 700;
}

.tag-chip.inbox {
  border-style: dashed;
}

.tag-chip.is-drag {
  z-index: 3;
  position: relative;
  transition: none;
}

.tag-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}

.tag-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-count {
  font-size: 10.5px;
  opacity: 0.75;
}

.drop-slot {
  flex: none;
  width: 4px;
  height: 22px;
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

.sort-hint {
  flex: none;
  font-size: 11px;
  color: var(--muted);
  padding-left: 6px;
}
</style>
