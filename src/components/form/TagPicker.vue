<template>
  <div class="picker">
    <div v-if="modelValue.length" class="chips">
      <span v-for="id in modelValue" :key="id" class="tag-chip" :style="{ background: colorOf(id) }">
        {{ nameOf(id) }}
        <button type="button" class="chip-x" @click="remove(id)">×</button>
      </span>
    </div>
    <div class="pool">
      <button
        v-for="tg in store.state.tags"
        :key="tg.id"
        type="button"
        class="pool-chip"
        :class="{ on: modelValue.includes(tg.id) }"
        :style="modelValue.includes(tg.id) ? { background: tg.color, borderColor: tg.color, color: '#fff' } : {}"
        @click="toggle(tg.id)"
      >
        {{ tg.name }}
      </button>
      <button type="button" class="pool-chip new" @click="creating = true">+ 新建标签</button>
    </div>

    <div v-if="creating" class="create-box">
      <div class="row gap8">
        <input v-model="newName" class="input" placeholder="标签名称" @keyup.enter="createTag" />
        <div class="color-row">
          <button
            v-for="c in TAG_COLORS"
            :key="c"
            type="button"
            class="color-dot"
            :class="{ on: newColor === c }"
            :style="{ background: c }"
            @click="newColor = c"
          />
        </div>
        <button type="button" class="btn btn-sm btn-primary" :disabled="!newName.trim()" @click="createTag">保存</button>
        <button type="button" class="btn btn-sm btn-ghost" @click="creating = false">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { store } from '../../store.js'
import { tagOf } from '../../selectors.js'
import { TAG_COLORS } from '../../theme.js'
import { showToast } from '../../ui.js'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue'])

const creating = ref(false)
const newName = ref('')
const newColor = ref(TAG_COLORS[0])

function colorOf(id) {
  const t = tagOf(store.state, id)
  return t ? t.color : '#64748B'
}

function nameOf(id) {
  const t = tagOf(store.state, id)
  return t ? t.name : '?'
}

function toggle(id) {
  const cur = [...props.modelValue]
  const i = cur.indexOf(id)
  if (i >= 0) cur.splice(i, 1)
  else cur.push(id)
  emit('update:modelValue', cur)
}

function remove(id) {
  emit('update:modelValue', props.modelValue.filter((x) => x !== id))
}

function createTag() {
  const name = newName.value.trim()
  if (!name) return
  store.addTag({ name, color: newColor.value })
  showToast('标签已创建')
  newName.value = ''
  creating.value = false
}
</script>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip-x {
  color: inherit;
  opacity: 0.8;
  margin-left: 2px;
  font-size: 13px;
  line-height: 1;
}

.pool {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.pool-chip {
  border: 1.5px solid var(--line);
  padding: 3px 11px;
  border-radius: 999px;
  font-size: 12.5px;
  color: var(--text-dim);
  background: var(--card);
}

.pool-chip.on {
  border-color: transparent;
}

.pool-chip.new {
  border-style: dashed;
}

.create-box {
  background: rgba(0, 0, 0, 0.03);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.color-row {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.color-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
}

.color-dot.on {
  border-color: var(--text);
  box-shadow: 0 0 0 2px var(--card);
}
</style>
