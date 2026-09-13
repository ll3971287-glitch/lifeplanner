<template>
  <div class="todos-view">
    <div class="toolbar card">
      <div class="row-between gap8 wrap">
        <SegControl :model-value="dueMode" :options="dueOptions" @update:model-value="dueMode = $event" />
        <template v-if="viewTab === 'mine'">
          <button type="button" class="btn btn-primary" @click="openNew">
            <Icon name="plus" :size="16" /> 新建任务
          </button>
        </template>
        <template v-else>
          <button type="button" class="btn btn-primary" @click="router.push('/projects')">
            <Icon name="briefcase" :size="16" /> 去项目添加任务
          </button>
        </template>
      </div>
      <div class="row gap8 tabs-row">
        <SegControl :model-value="viewTab" :options="tabOptions" @update:model-value="onSwitchTab" />
        <select v-model="sortMode" class="select select-sm" title="排序方式">
          <option value="custom">自定义顺序</option>
          <option value="time">按时间</option>
          <option value="priority">按重要程度</option>
        </select>
        <span class="muted count-text">{{ visibleCount }} 项</span>
      </div>
      <div v-if="tabTodos.length" class="row gap8 filters">
        <select v-model="tagFilter" class="select select-sm">
          <option value="">全部标签</option>
          <option v-for="tg in store.state.tags" :key="tg.id" :value="tg.id">{{ tg.name }}</option>
        </select>
        <label class="check-pill" title="只显示未完成任务">
          <input v-model="onlyOpen" type="checkbox" />
          <span>只显示未完成</span>
        </label>
      </div>
    </div>

    <div class="list-wrap card">
      <template v-if="roots.length">
        <TaskItem v-for="r in roots" :key="r.id" :todo="r" :depth="0" :sort-mode="sortMode" :drag-enabled="sortMode === 'custom'" @open="openDrawer" @focus="startFocus" />
      </template>
      <EmptyState v-else-if="!store.state.todos.length" icon="todo" text="还没有任务" hint="点「新建任务」开始计划今天">
        <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="openNew">
          <Icon name="plus" :size="16" /> 新建第一个任务
        </button>
      </EmptyState>
      <EmptyState v-else-if="viewTab === 'projects' && !tabTodos.length" icon="briefcase" text="项目任务为空" hint="去项目页面里添加任务，它们会单独显示在这里">
        <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="router.push('/projects')">
          <Icon name="briefcase" :size="16" /> 去项目添加任务
        </button>
      </EmptyState>
      <EmptyState v-else-if="!tabTodos.length" icon="todo" text="我的任务为空" hint="点「新建任务」添加自己的任务">
        <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="openNew">
          <Icon name="plus" :size="16" /> 新建任务
        </button>
      </EmptyState>
      <EmptyState v-else icon="search" text="没有匹配的任务" hint="试试调整筛选条件" />
    </div>

    <BaseModal :open="form.open" :title="form.todo ? '编辑任务' : '新建任务'" @close="form.open = false">
      <TodoFormModal
        v-if="form.open"
        :todo="form.todo"
        :default-parent-id="form.parentId"
        :preset-time="form.preset"
        @close="form.open = false"
        @saved="onSaved"
      />
    </BaseModal>

    <TaskDrawer
      :open="drawerId != null"
      :todo-id="drawerId"
      @close="drawerId = null"
      @edit="openEdit"
      @focus="startFocus"
      @add-sub="openAddSub"
    />
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../store.js'
import { selectDueTodos, todoRoots, visibleTreeSet, compareTasksByMode } from '../selectors.js'
import { startOfDayTs } from '../utils/date.js'
import Icon from '../components/ui/Icon.vue'
import SegControl from '../components/ui/SegControl.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import TodoFormModal from '../components/todo/TodoFormModal.vue'
import TaskItem from '../components/todo/TaskItem.vue'
import TaskDrawer from '../components/todo/TaskDrawer.vue'

const router = useRouter()

const viewTab = ref('mine')
const sortMode = ref('custom')
const tabOptions = [
  { label: '我的任务', value: 'mine' },
  { label: '项目任务', value: 'projects' },
]

const dueMode = ref('all')
const tagFilter = ref('')
const statusFilter = ref('all')
// 「只显示未完成」勾选 = 状态筛选开；取消勾选 = 全部
const onlyOpen = computed({
  get: () => statusFilter.value === 'open',
  set: (v) => {
    statusFilter.value = v ? 'open' : 'all'
  },
})
const drawerId = ref(null)
const nowTs = ref(Date.now())

const timer = setInterval(() => {
  nowTs.value = Date.now()
}, 60000)
onBeforeUnmount(() => clearInterval(timer))

const dueOptions = [
  { label: '全部', value: 'all' },
  { label: '今天', value: 'today' },
  { label: '逾期', value: 'overdue' },
]

function onSwitchTab(v) {
  viewTab.value = v
  tagFilter.value = ''
  statusFilter.value = 'all'
}

// 按“所属树根”拆分：项目任务的整棵子树归入“项目任务”视图
const todosById = computed(() => {
  const m = new Map()
  for (const t of store.state.todos) m.set(t.id, t)
  return m
})

function rootOf(t) {
  let cur = t
  const seen = new Set()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    if (!cur.parentId) return cur
    cur = todosById.value.get(cur.parentId) || null
  }
  return null
}

const tabTodos = computed(() => {
  const wantProject = viewTab.value === 'projects'
  return store.state.todos.filter((t) => {
    const root = rootOf(t)
    return wantProject ? !!(root && root.projectId) : !(root && root.projectId)
  })
})

const hits = computed(() => {
  const now = nowTs.value
  const dayStart = startOfDayTs(now)
  const modeList = selectDueTodos(tabTodos.value, dueMode.value, now)
  const set = new Set()
  for (const t of modeList) {
    if (tagFilter.value && !(t.tagIds || []).includes(tagFilter.value)) continue
    if (statusFilter.value === 'open' && t.completed) continue
    if (statusFilter.value === 'done' && !t.completed) continue
    set.add(t.id)
  }
  return set
})

const visible = computed(() => visibleTreeSet(tabTodos.value, hits.value))

const roots = computed(() => todoRoots(tabTodos.value).filter((r) => visible.value.has(r.id)).sort((a, b) => compareTasksByMode(a, b, sortMode.value)))

const visibleCount = computed(() => roots.value.length)

const form = ref({ open: false, todo: null, parentId: null, preset: null })

function openNew() {
  form.value = { open: true, todo: null, parentId: null, preset: null }
}

function openAddSub(parent) {
  form.value = { open: true, todo: null, parentId: parent.id, preset: null }
}

function openEdit(todo) {
  drawerId.value = null
  form.value = { open: true, todo, parentId: null, preset: null }
}

function onSaved() {
  drawerId.value = null
}

function openDrawer(todo) {
  drawerId.value = todo.id
}

function startFocus(todo) {
  store.openFocus({ mode: 'pomodoro', targetType: 'todo', targetId: todo.id })
}
</script>

<style scoped>
.check-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--muted);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.check-pill input {
  width: 15px;
  height: 15px;
  accent-color: var(--accent);
  cursor: pointer;
}
.todos-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wrap {
  flex-wrap: wrap;
}

.filters {
  flex-wrap: wrap;
}

.select-sm {
  width: auto;
  min-width: 110px;
  padding: 5px 10px;
  font-size: 13px;
}

.count-text {
  margin-left: auto;
}

.tabs-row {
  padding-top: 2px;
}

.list-wrap {
  overflow: hidden;
}
</style>
