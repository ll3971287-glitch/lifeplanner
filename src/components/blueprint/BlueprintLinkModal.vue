<template>
  <BaseModal :open="open" :title="titleText" @close="$emit('close')">
    <p class="muted hint">蓝图与项目 / 待办互为关联：关联后任一侧都可跳转查看。</p>

    <div class="row gap4 seg">
      <button v-for="t in tabs" :key="t.key" type="button" class="tab" :class="{ on: tab === t.key }" @click="switchTab(t.key)">
        {{ t.label }}
      </button>
    </div>

    <div class="pool">
      <label v-for="it in poolItems" :key="it.id" class="row gap8 pick" :class="{ on: picked.has(it.id) }">
        <input v-model="pickedSet" type="checkbox" :value="it.id" />
        <span class="pick-title">{{ it.name }}</span>
      </label>
      <p v-if="!poolItems.length" class="muted empty-line">没有可选的{{ tab === 'project' ? '项目' : '任务' }}。</p>
    </div>

    <div class="row gap8" style="justify-content: flex-end; margin-top: 12px">
      <button type="button" class="btn btn-outline btn-sm" @click="$emit('close')">取消</button>
      <button type="button" class="btn btn-primary btn-sm" @click="commit">保存关联</button>
    </div>
  </BaseModal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import { store } from '../../store.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  // blueprint 模式：把项目/任务挂到某蓝图；todo/project 模式：把该条目挂到多个蓝图
  mode: { type: String, default: 'blueprint' },
  blueprintId: { type: String, default: null },
  targetType: { type: String, default: 'todo' },
  targetId: { type: String, default: null },
})
const emit = defineEmits(['close'])

const tab = ref('todo')
const tabs = computed(() => {
  if (props.mode !== 'blueprint') {
    return [{ key: 'bp', label: '蓝图' }]
  }
  return [
    { key: 'todo', label: '待办任务' },
    { key: 'project', label: '项目' },
  ]
})
const titleText = computed(() => (props.mode === 'blueprint' ? '关联项目 / 任务' : '绑定到未来蓝图'))

const picked = ref(new Set())
const pickedSet = computed({
  get: () => picked.value,
  set: (val) => {
    picked.value = val
  },
})

const activeTab = computed(() => (props.mode !== 'blueprint' ? 'bp' : tab.value))

function switchTab(k) {
  tab.value = k
}

const poolItems = computed(() => {
  if (activeTab.value === 'bp') {
    return store.state.blueprints.map((b) => ({ id: b.id, name: b.title }))
  }
  if (activeTab.value === 'project') {
    return store.state.projects.map((p) => ({ id: p.id, name: p.name }))
  }
  // 顶层待办（含项目内顶层任务），按 order
  return store.state.todos
    .filter((t) => !t.parentId)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((t) => ({ id: t.id, name: t.title }))
})

watch(
  () => [props.open, props.mode, props.blueprintId, props.targetId],
  () => {
    picked.value = new Set()
    if (!props.open) return
    if (props.mode !== 'blueprint') {
      const obj = (props.targetType === 'project' ? store.state.projects : store.state.todos).find((x) => x.id === props.targetId)
      picked.value = new Set(obj && Array.isArray(obj.blueprintIds) ? obj.blueprintIds : [])
    } else {
      const b = store.state.blueprints.find((x) => x.id === props.blueprintId)
      if (b) {
        picked.value = new Set((b.related || []).filter((r) => r.type === activeTab.value).map((r) => r.id))
      }
    }
  },
  { immediate: true }
)

function commit() {
  if (props.mode !== 'blueprint') {
    const type = props.targetType
    const id = props.targetId
    for (const b of store.state.blueprints) {
      const has = (b.related || []).some((r) => r.type === type && r.id === id)
      const want = picked.value.has(b.id)
      if (want && !has) {
        store.syncRelated(b.id, [...(b.related || []), { type, id }])
      } else if (!want && has) {
        store.syncRelated(
          b.id,
          (b.related || []).filter((r) => !(r.type === type && r.id === id))
        )
      }
    }
  } else {
    const b = store.state.blueprints.find((x) => x.id === props.blueprintId)
    if (b) {
      const others = (b.related || []).filter((r) => r.type !== activeTab.value)
      const ids = [...picked.value]
      const merged = [...others, ...ids.map((id) => ({ type: activeTab.value, id }))]
      store.syncRelated(b.id, merged)
    }
  }
  emit('close')
}
</script>

<style scoped>
.hint {
  margin: 0 0 10px;
  font-size: 12.5px;
}

.seg {
  margin-bottom: 10px;
}

.tab {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  border: 1px solid var(--line);
  color: var(--muted);
  background: var(--panel);
}

.tab.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--text);
  font-weight: 700;
}

.pool {
  max-height: 300px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pick {
  padding: 8px 6px;
  border-radius: 10px;
  font-size: 14px;
}

.pick.on {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.pick input {
  width: 15px;
  height: 15px;
  accent-color: var(--accent);
}

.pick-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-line {
  font-size: 13px;
  text-align: center;
  padding: 12px 0;
}
</style>
