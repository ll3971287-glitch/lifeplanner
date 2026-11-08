<template>
  <div class="tag-bar">
    <div
      ref="barRef"
      class="bar-scroll"
      :class="{ dragging: isDragging }"
      @pointerdown="onDragStart"
      @pointermove="onDragMove"
      @pointerup="onDragEnd"
      @pointercancel="onDragEnd"
      @click.capture="onBarClick"
    >
      <button type="button" class="tag-chip" :class="{ on: modelValue === '' }" @click="pick('')">全部</button>
      <button
        type="button"
        class="tag-chip inbox"
        :class="{ on: modelValue === '__none' }"
        @click="pick(modelValue === '__none' ? '' : '__none')"
      >
        <Icon name="box" :size="12" /> 收集箱 {{ noTagCount }}
      </button>
      <button
        type="button"
        class="tag-chip fleeting"
        :class="{ on: modelValue === '__fleeting' }"
        @click="pick(modelValue === '__fleeting' ? '' : '__fleeting')"
      >
        <Icon name="sparkles" :size="12" /> 随想 {{ fleetingCount }}
      </button>
      <button
        v-for="tg in list"
        :key="tg.id"
        type="button"
        class="tag-chip"
        :class="{ on: modelValue === tg.id }"
        :style="chipStyle(tg)"
        @click="pick(modelValue === tg.id ? '' : tg.id)"
      >
        <i class="tag-dot" :style="{ background: tg.color }" />
        <span class="tag-name">{{ tg.name }}</span>
        <span class="tag-count">{{ countOf(tg.id) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '../ui/Icon.vue'
import { store } from '../../store.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  counts: { type: Object, default: () => ({}) },
  noTagCount: { type: Number, default: 0 },
  fleetingCount: { type: Number, default: 0 },
})
const emit = defineEmits(['update:modelValue'])

const list = computed(() => store.state.tags)

// —— 按住拖动横向滚动（待办页不需要排序，只要能拖着浏览）——
const barRef = ref(null)
const isDragging = ref(false)
let startX = 0
let startScroll = 0
let dragging = false
let moved = false

function onDragStart(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  const el = barRef.value
  if (!el) return
  dragging = true
  moved = false
  isDragging.value = false
  startX = e.clientX
  startScroll = el.scrollLeft
}

function onDragMove(e) {
  if (!dragging) return
  const el = barRef.value
  if (!el) return
  const dx = e.clientX - startX
  if (!moved && Math.abs(dx) > 6) {
    moved = true
    isDragging.value = true
  }
  if (moved) el.scrollLeft = startScroll - dx
}

function onDragEnd() {
  dragging = false
  isDragging.value = false
}

// 拖动后松手不要误触发标签筛选
function onBarClick(e) {
  if (!moved) return
  e.preventDefault()
  e.stopPropagation()
  moved = false
}

// 手指/鼠标移出标签栏时也能继续拖
onMounted(() => {
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragEnd)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
})

function countOf(id) {
  return props.counts[id] || 0
}
function chipStyle(tg) {
  return props.modelValue === tg.id ? { background: tg.color, borderColor: tg.color, color: '#fff' } : undefined
}
function pick(v) {
  emit('update:modelValue', v)
}
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
  -webkit-overflow-scrolling: touch;
  /* 纵向滑动仍交给页面滚动，横向由拖动手势控制 */
  touch-action: pan-y;
  overscroll-behavior-x: contain;
  cursor: grab;
}

.bar-scroll.dragging {
  cursor: grabbing;
  scroll-behavior: auto;
  user-select: none;
}

.bar-scroll.dragging .tag-chip {
  pointer-events: none;
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
  touch-action: manipulation;
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

.tag-chip.fleeting {
  border-style: dotted;
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
</style>
