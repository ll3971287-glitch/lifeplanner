<template>
  <div class="tag-bar">
    <div class="bar-scroll">
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
import { computed } from 'vue'
import Icon from '../ui/Icon.vue'
import { store } from '../../store.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  counts: { type: Object, default: () => ({}) },
  noTagCount: { type: Number, default: 0 },
})
const emit = defineEmits(['update:modelValue'])

const list = computed(() => store.state.tags)

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
