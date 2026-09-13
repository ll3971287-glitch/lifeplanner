<template>
  <div class="todo-form">
    <div class="field">
      <span class="field-label">标题 *</span>
      <input v-model="form.title" class="input" placeholder="要做什么？" autofocus @keyup.enter="save" />
    </div>

    <div v-if="project" class="field">
      <span class="field-label">所属项目</span>
      <div class="proj-fixed">{{ project.name }}</div>
    </div>
    <div v-else-if="!editing" class="field">
      <span class="field-label">归属</span>
      <select v-model="form.parentChoice" class="select">
        <option value="none">作为主任务</option>
        <option v-for="p in store.state.projects" :key="'p' + p.id" :value="'p:' + p.id">项目：{{ p.name }}</option>
        <option v-for="opt in parentOptions" :key="'t' + opt.id" :value="'t:' + opt.id">{{ opt.prefix }}{{ opt.title }}</option>
      </select>
    </div>

    <div class="field">
      <span class="field-label">时间</span>
      <DateTimeFields v-model="form.time" />
    </div>

    <div class="field">
      <span class="field-label">优先级</span>
      <SegControl :model-value="form.priority" :options="priOptions" @update:model-value="form.priority = $event" />
    </div>

    <div v-if="form.time.timeType !== 'none'" class="field">
      <span class="field-label">循环</span>
      <div class="row gap8 wrap">
        <SegControl :model-value="recurFreq" :options="recurOptions" @update:model-value="recurFreq = $event" />
        <div v-if="recurFreq !== 'none'" class="row gap6">
          <span class="muted">每</span>
          <input v-model.number="recurStep" type="number" min="1" max="365" class="input step-input" @change="clampStep" />
          <span class="muted">{{ stepUnit }}</span>
        </div>
      </div>
      <p class="muted rec-tip">完成后自动生成下一期任务，历史完成记录保留</p>
    </div>

    <div class="field">
      <span class="field-label">标签</span>
      <TagPicker v-model="form.tagIds" />
    </div>

    <div class="field">
      <span class="field-label">备注</span>
      <textarea v-model="form.note" class="textarea" rows="2" placeholder="补充说明（可选）" />
    </div>

    <div v-if="err" class="err-text">{{ err }}</div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" @click="$emit('close')">取消</button>
      <button type="button" class="btn btn-primary" @click="save">保存</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store } from '../../store.js'
import { todoChildren, todoRoots, subtreeIds } from '../../selectors.js'
import DateTimeFields from '../form/DateTimeFields.vue'
import TagPicker from '../form/TagPicker.vue'
import SegControl from '../ui/SegControl.vue'
import { showToast } from '../../ui.js'

const props = defineProps({
  todo: { type: Object, default: null },
  defaultParentId: { type: String, default: null },
  presetTime: { type: Object, default: null },
  project: { type: Object, default: null },
})

const emit = defineEmits(['close', 'saved'])

const editing = computed(() => !!props.todo)

function initForm() {
  const base = props.presetTime || { timeType: 'none', startAt: null, endAt: null }
  return {
    title: props.todo ? props.todo.title : '',
    note: props.todo ? props.todo.note : '',
    parentChoice: props.defaultParentId ? 't:' + props.defaultParentId : 'none',
    tagIds: props.todo ? [...(props.todo.tagIds || [])] : [],
    recurrence: props.todo ? props.todo.recurrence : null,
    priority: props.todo ? props.todo.priority || 'none' : 'none',
    time: {
      timeType: props.todo ? props.todo.timeType : base.timeType,
      startAt: props.todo ? props.todo.startAt : base.startAt,
      endAt: props.todo ? props.todo.endAt : base.endAt,
    },
  }
}

const form = ref(initForm())
const err = ref('')

const recurFreq = ref(form.value.recurrence ? form.value.recurrence.freq : 'none')
const recurStep = ref(form.value.recurrence ? form.value.recurrence.step || 1 : 1)

const recurOptions = [
  { label: '不重复', value: 'none' },
  { label: '每日', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
  { label: '每年', value: 'yearly' },
]

const REC_UNIT = { daily: '天', weekly: '周', monthly: '个月', yearly: '年' }

const priOptions = [
  { label: '默认', value: 'none' },
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
]

const stepUnit = computed(() => REC_UNIT[recurFreq.value] || '')

function clampStep() {
  recurStep.value = Math.max(1, Math.round(recurStep.value) || 1)
}

const parentOptions = computed(() => {
  const exclude = new Set()
  if (props.todo) for (const id of subtreeIds(store.state.todos, props.todo.id)) exclude.add(id)
  const out = []
  const walk = (id, depth) => {
    const t = store.state.todos.find((x) => x.id === id)
    if (t) {
      out.push({ id: t.id, title: t.title, prefix: '　'.repeat(depth) + (depth ? '└ ' : '') })
      for (const c of todoChildren(store.state.todos, t.id)) walk(c.id, depth + 1)
    }
  }
  for (const r of todoRoots(store.state.todos)) {
    if (!exclude.has(r.id)) walk(r.id, 0)
  }
  return out
})

function save() {
  const title = form.value.title.trim()
  if (!title) {
    err.value = '请填写任务标题'
    return
  }
  const time = form.value.time
  if (time.timeType === 'range' && (!time.startAt || !time.endAt || time.endAt <= time.startAt)) {
    err.value = '时间段需要有效的开始与结束时间（结束晚于开始）'
    return
  }
  if ((time.timeType === 'date' || time.timeType === 'datetime') && !time.startAt) {
    err.value = '请选择日期时间'
    return
  }
  let parentId = null
  let projectId = null
  if (props.project) {
    projectId = props.project.id
  } else {
    const pc = form.value.parentChoice || 'none'
    if (pc.startsWith('p:')) projectId = pc.slice(2)
    else if (pc.startsWith('t:')) parentId = pc.slice(2)
  }
  const payload = {
    title,
    note: form.value.note,
    timeType: time.timeType,
    startAt: time.startAt,
    endAt: time.endAt,
    tagIds: form.value.tagIds,
    priority: form.value.priority === 'none' ? null : form.value.priority,
    recurrence: time.timeType === 'none' || recurFreq.value === 'none' ? null : { freq: recurFreq.value, step: Math.max(1, recurStep.value || 1) },
  }
  if (editing.value) {
    store.updateTodo(props.todo.id, payload)
    showToast('已保存')
  } else {
    store.addTodo({ ...payload, parentId, projectId })
    showToast('已添加')
  }
  emit('saved')
  emit('close')
}
</script>

<style scoped>
.todo-form {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.err-text {
  color: var(--danger);
  font-size: 13px;
}

.rec-tip {
  margin: 6px 0 0;
  font-size: 12px;
}

.step-input {
  width: 74px;
  padding: 5px 8px;
}

.proj-fixed {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent-deep);
  font-weight: 700;
  border-radius: 10px;
  padding: 8px 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 2px;
}
</style>
