<template>
  <div class="todos-view">
    <div class="toolbar card">
      <div class="row-between gap8 wrap">
        <SegControl :model-value="archiveView ? '' : dueMode" :options="dueOptions" @update:model-value="dueMode = $event" />
        <div class="row gap8">
          <button type="button" class="btn btn-outline" :class="{ on: archiveView }" @click="archiveView = !archiveView">
            <Icon name="layers" :size="15" /> 归档箱（{{ archivedCount }}）
          </button>
          <button type="button" class="btn btn-primary" @click="openNew">
            <Icon name="plus" :size="16" /> 新建任务
          </button>
        </div>
      </div>
      <div class="row gap8 tabs-row">
        <select v-model="sortMode" class="select select-sm" title="排序方式">
          <option value="custom">自定义顺序</option>
          <option value="time">按时间</option>
          <option value="priority">按重要程度</option>
        </select>
        <span class="muted count-text">{{ archiveView ? `${archivedList.length} 项已归档` : `${visibleCount} 项` }}</span>
      </div>
      <TagFilterBar
        v-if="!archiveView"
        v-model="tagFilter"
        :counts="tagCountMap"
        :no-tag-count="noTagCount"
      />
    </div>

    <!-- 归档箱 -->
    <div v-if="archiveView" class="list-wrap card">
      <template v-if="archivedList.length">
        <div v-for="t in archivedList" :key="t.id" class="arch-row">
          <span class="arch-state" :class="{ canceled: t.canceled, done: t.completed }">
            {{ t.canceled ? '已取消' : '已完成' }}
          </span>
          <span class="arch-title">{{ t.title }}</span>
          <span class="muted mini arch-time">{{ fmtDate(t.completedAt || t.canceledAt) }}</span>
          <button type="button" class="btn btn-outline btn-sm" @click="restore(t)">恢复</button>
          <button type="button" class="mini del-btn" title="删除" @click="removeArchived(t)"><Icon name="trash" :size="14" /></button>
        </div>
      </template>
      <EmptyState v-else icon="layers" text="归档箱是空的" hint="完成或取消的任务会收进这里，可随时恢复" />
    </div>

    <div v-else class="list-wrap card">
      <template v-if="roots.length">
        <TaskItem v-for="r in roots" :key="r.id" :todo="r" :depth="0" :sort-mode="sortMode" :drag-enabled="sortMode === 'custom'" @open="openDrawer" @focus="startFocus" @cancel="cancelTask" @schedule="openSchedule" />
      </template>
      <EmptyState v-else-if="!store.state.todos.length" icon="todo" text="还没有任务" hint="点「新建任务」开始计划今天">
        <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="openNew">
          <Icon name="plus" :size="16" /> 新建第一个任务
        </button>
      </EmptyState>
      <EmptyState v-else-if="!tabTodos.length" icon="todo" text="还没有任务" hint="点「新建任务」开始计划">
        <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="openNew">
          <Icon name="plus" :size="16" /> 新建任务
        </button>
      </EmptyState>
      <EmptyState v-else icon="search" :text="`${dueLabel}没有任务`" hint="试试切换其它分组（全部 / 今天 / 逾期 / 本周 / 本月）" />
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

    <ScheduleModal :open="scheduleId != null" :todo-id="scheduleId" @close="scheduleId = null" />

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
import { selectDueTodos, todoRoots, visibleTreeSet, compareTasksByMode, isArchived, archivedTodos } from '../selectors.js'
import { fmtDate } from '../utils/date.js'
import Icon from '../components/ui/Icon.vue'
import SegControl from '../components/ui/SegControl.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import TodoFormModal from '../components/todo/TodoFormModal.vue'
import TaskItem from '../components/todo/TaskItem.vue'
import TaskDrawer from '../components/todo/TaskDrawer.vue'
import ScheduleModal from '../components/todo/ScheduleModal.vue'
import TagFilterBar from '../components/tag/TagFilterBar.vue'
import { askConfirm, showToast } from '../ui.js'

const router = useRouter()

const sortMode = ref('custom')
const archiveView = ref(false)

// 进入待办页默认定位到「今天」
const dueMode = ref('today')
const tagFilter = ref('')
const drawerId = ref(null)
const scheduleId = ref(null)
const nowTs = ref(Date.now())

const timer = setInterval(() => {
  nowTs.value = Date.now()
}, 60000)
onBeforeUnmount(() => clearInterval(timer))

const dueOptions = [
  { label: '全部', value: 'all' },
  { label: '今天', value: 'today' },
  { label: '逾期', value: 'overdue' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
]
const dueLabel = computed(() => (dueOptions.find((o) => o.value === dueMode.value) || dueOptions[0]).label)

// 「我的任务」与「项目任务」合并：统一展示所有任务（项目任务行内已显示项目名）
const tabTodos = computed(() => store.state.todos)

const hits = computed(() => {
  const now = nowTs.value
  const modeList = selectDueTodos(tabTodos.value, dueMode.value, now)
  const set = new Set()
  for (const t of modeList) {
    // 标签筛选：__none 表示收集箱（无标签任务）
    if (tagFilter.value === '__none') {
      if ((t.tagIds || []).length) continue
    } else if (tagFilter.value && !(t.tagIds || []).includes(tagFilter.value)) {
      continue
    }
    set.add(t.id)
  }
  return set
})

const visible = computed(() => visibleTreeSet(tabTodos.value, hits.value))

const roots = computed(() =>
  todoRoots(tabTodos.value)
    .filter((r) => visible.value.has(r.id) && !isArchived(r))
    .sort((a, b) => compareTasksByMode(a, b, sortMode.value))
)

// 归档箱
const archivedList = computed(() => (archiveView.value ? archivedTodos(store.state) : []))
const archivedCount = computed(() => archivedTodos(store.state).length)

async function cancelTask(todo) {
  const ok = await askConfirm({
    title: '取消任务',
    message: `取消「${todo.title}」并移入归档箱？`,
    detail: '已取消的任务不再出现在待办列表，可在归档箱里随时恢复。',
    danger: true,
    okText: '取消任务',
  })
  if (!ok) return
  store.cancelTodo(todo.id)
  showToast('已移入归档箱')
}

function openSchedule(todo) {
  scheduleId.value = todo.id
}

function restore(t) {
  store.restoreTodo(t.id)
  showToast('已恢复到待办')
}

async function removeArchived(t) {
  const ok = await askConfirm({ title: '删除任务', message: `彻底删除「${t.title}」？`, danger: true, okText: '删除' })
  if (!ok) return
  store.deleteTodo(t.id)
  showToast('已删除')
}

const visibleCount = computed(() => roots.value.length)

// 标签栏计数：当前分组内（未归档）各标签的任务数 + 收集箱（无标签）数量
const tagCountMap = computed(() => {
  const modeList = selectDueTodos(tabTodos.value, dueMode.value, nowTs.value)
  const map = {}
  for (const t of modeList) {
    for (const id of t.tagIds || []) map[id] = (map[id] || 0) + 1
  }
  return map
})
const noTagCount = computed(() => {
  const modeList = selectDueTodos(tabTodos.value, dueMode.value, nowTs.value)
  return modeList.filter((t) => !(t.tagIds || []).length).length
})

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
