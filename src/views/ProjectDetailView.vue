<template>
  <div v-if="project" class="detail-view">
    <header class="head-card card">
      <div class="row-between wrap gap8">
        <div>
          <div class="row gap8">
            <span class="type-badge" :class="project.type === '工作' ? 'work' : 'study'">{{ project.type }}</span>
            <span v-if="isOverdue" class="late">已逾期</span>
            <span v-if="project.completed" class="done-chip">已完成</span>
          </div>
          <h2 class="p-name">{{ project.name }}</h2>
          <p v-if="project.desc" class="p-desc">{{ project.desc }}</p>
        </div>
        <div class="row gap6 actions">
          <button type="button" class="btn btn-outline btn-sm" @click="openEditProject">
            <Icon name="edit" :size="13" /> 编辑
          </button>
          <button v-if="stats.allDone && !project.completed" type="button" class="btn btn-primary btn-sm" @click="doArchive">
            <Icon name="check" :size="13" /> 归档项目
          </button>
          <button v-if="project.completed" type="button" class="btn btn-outline btn-sm" @click="reopenProject">
            <Icon name="refresh" :size="13" /> 重新打开
          </button>
          <button type="button" class="icon-btn danger" title="删除项目" @click="doDelete">
            <Icon name="trash" :size="16" />
          </button>
        </div>
      </div>

      <div class="meta-row row gap12 wrap">
        <span class="muted">{{ progressText }}</span>
        <span v-if="project.totalWorkload > 0 && project.progressMode !== 'hours'" class="muted">总工作量 {{ project.totalWorkload }}{{ project.workloadUnit }}</span>
        <span v-if="project.deadline" class="due-text" :class="{ late: isOverdue }">{{ deadlineText(project.deadline) }}</span>
        <TagChips :tag-ids="project.tagIds" />
        <button v-if="bpChips.length" type="button" class="bp-chip" @click="router.push('/blueprints')">
          <Icon name="flag" :size="11" /> 蓝图 · {{ bpChips.map((b) => b.title).join(' / ') }}
        </button>
        <button v-if="hasBlueprints" type="button" class="btn btn-outline btn-sm" @click="linkBpOpen = true">关联蓝图</button>
      </div>

      <div class="row gap8 progress-row">
        <ProgressBar :value="stats.pct" />
        <span class="pct">{{ stats.pct }}%</span>
      </div>
    </header>

    <div class="toolbar card">
      <div class="row-between wrap gap8">
        <SegControl :model-value="viewMode" :options="viewOptions" @update:model-value="viewMode = $event" />
        <button type="button" class="btn btn-primary btn-sm" @click="openAddTask">
          <Icon name="plus" :size="15" /> 新建任务
        </button>
      </div>
      <div class="row gap8 filter-row">
        <select v-model="statusFilter" class="select select-sm">
          <option value="all">全部状态</option>
          <option value="open">未完成</option>
          <option value="done">已完成</option>
        </select>
        <select v-model="tagFilter" class="select select-sm">
          <option value="">全部标签</option>
          <option v-for="tg in store.state.tags" :key="tg.id" :value="tg.id">{{ tg.name }}</option>
        </select>
        <span class="muted count">{{ filteredTasks.length }} 个任务</span>
      </div>
    </div>

    <EmptyState v-if="!projectSubTasks(store.state, project.id).length" icon="layers" text="还没有任务" hint="在项目里添加任务，与普通待办一样可勾选完成、设时间、再拆子任务">
      <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="openAddTask">
        <Icon name="plus" :size="16" /> 添加第一个任务
      </button>
    </EmptyState>
    <EmptyState v-else-if="!filteredTasks.length" icon="search" text="没有匹配的任务" hint="调整筛选条件试试" />

    <div v-if="viewMode === 'grid'" class="grid">
      <button
        v-for="t in filteredTasks"
        :key="t.id"
        type="button"
        class="sub-cell card"
        :class="{ done: t.completed }"
        @click="openTaskDrawer(t)"
      >
        <span class="status-bar" :class="t.completed ? 's-done' : 's-open'" />
        <span v-if="t.priority" class="pri-bar2" :class="'pri-' + t.priority" />
        <div class="row-between">
          <span class="status-text" :class="{ done: t.completed }">{{ t.completed ? '已完成' : '未完成' }}</span>
          <button
            type="button"
            class="check"
            :class="{ on: t.completed }"
            :aria-label="t.completed ? '标记未完成' : '标记完成'"
            @click.stop="store.toggleTodo(t.id)"
          >
            <Icon v-if="t.completed" name="check" :size="12" />
          </button>
        </div>
        <div class="cell-name" :class="{ done: t.completed }">{{ t.title }}</div>
        <div class="row gap6 cell-meta">
          <span v-if="tText(t)" class="due-mini">{{ tText(t) }}</span>
          <span v-if="tLate(t)" class="due-mini late">已逾期</span>
          <span v-if="project.progressMode === 'hours' && t.estimatedHours" class="due-mini">约 {{ t.estimatedHours }}{{ project.workloadUnit }}</span>
        </div>
        <div class="row-between cell-foot">
          <div class="row gap4 wrap">
            <TagChips :tag-ids="t.tagIds" />
          </div>
          <span class="focus-mini" title="开始专注" @click.stop="startFocus(t)">
            <Icon name="clock" :size="13" />
          </span>
        </div>
      </button>
    </div>

    <div v-else class="list card">
      <div v-for="t in filteredTasks" :key="t.id" class="list-row" :class="{ done: t.completed }" @click="openTaskDrawer(t)">
        <button type="button" class="check" :class="{ on: t.completed }" @click.stop="store.toggleTodo(t.id)">
          <Icon v-if="t.completed" name="check" :size="12" />
        </button>
        <div class="row gap6 list-main">
          <span class="list-name" :class="{ done: t.completed }">{{ t.title }}</span>
          <span v-if="t.priority" class="pri-bar2" :class="'pri-' + t.priority" />
          <span v-if="tText(t)" class="due-mini">{{ tText(t) }}</span>
          <TagChips :tag-ids="t.tagIds" />
        </div>
        <span class="focus-mini" title="开始专注" @click.stop="startFocus(t)">
          <Icon name="clock" :size="14" />
        </span>
      </div>
    </div>

    <BaseModal :open="editOpen" :title="formProject ? '编辑项目' : '新建任务'" @close="editOpen = false">
      <template v-if="formProject">
        <ProjectFormModal :open="editOpen" :project="formProject" @close="editOpen = false" @saved="editOpen = false" />
      </template>
      <template v-else>
        <TodoFormModal
          v-if="editOpen"
          :project="project"
          :todo="formTodo"
          :default-parent-id="formParentId"
          :preset-time="formPreset"
          @close="editOpen = false"
          @saved="editOpen = false"
        />
      </template>
    </BaseModal>

    <TaskDrawer :open="taskDrawerId != null" :todo-id="taskDrawerId" @close="taskDrawerId = null" @edit="openEditTask" @focus="startFocus" @add-sub="openAddSub" />
    <BlueprintLinkModal :open="linkBpOpen" mode="project" target-type="project" :target-id="route.params.id" @close="linkBpOpen = false" />
  </div>

  <EmptyState v-else icon="briefcase" text="项目不存在或已删除" hint="返回项目列表看看">
    <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="router.push('/projects')">返回项目</button>
  </EmptyState>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store } from '../store.js'
import {
  projectSubTasks,
  projectStats,
  projectById,
  projectOverdue,
  projectProgressText,
  todoOverdue,
  tagsOf,
} from '../selectors.js'
import { fmtDateTime } from '../utils/date.js'
import { todoTimeText, deadlineText } from '../format.js'
import { askConfirm, showToast } from '../ui.js'
import Icon from '../components/ui/Icon.vue'
import SegControl from '../components/ui/SegControl.vue'
import ProgressBar from '../components/ui/ProgressBar.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import TagChips from '../components/ui/TagChips.vue'
import BlueprintLinkModal from '../components/blueprint/BlueprintLinkModal.vue'
import ProjectFormModal from '../components/project/ProjectFormModal.vue'
import TodoFormModal from '../components/todo/TodoFormModal.vue'
import TaskDrawer from '../components/todo/TaskDrawer.vue'

const route = useRoute()
const router = useRouter()

const project = computed(() => projectById(store.state, route.params.id))
const bpChips = computed(() => {
  if (!project.value) return []
  const ids = project.value.blueprintIds || []
  return store.state.blueprints.filter((b) => ids.includes(b.id))
})
const hasBlueprints = computed(() => store.state.blueprints.length > 0)
const linkBpOpen = ref(false)
const stats = computed(() => (project.value ? projectStats(store.state, project.value.id) : { done: 0, total: 0, pct: 0, allDone: false }))
const progressText = computed(() => (project.value ? projectProgressText(store.state, project.value.id) : ''))
const isOverdue = computed(() => (project.value ? projectOverdue(project.value, Date.now()) : false))

const viewMode = ref('grid')
const statusFilter = ref('all')
const tagFilter = ref('')
const editOpen = ref(false)
const formProject = ref(null)
const formTodo = ref(null)
const formParentId = ref(null)
const formPreset = ref(null)
const taskDrawerId = ref(null)

const viewOptions = [
  { label: '网格', value: 'grid' },
  { label: '列表', value: 'list' },
]

const filteredTasks = computed(() => {
  if (!project.value) return []
  let list = projectSubTasks(store.state, project.value.id)
  if (statusFilter.value === 'open') list = list.filter((t) => !t.completed)
  if (statusFilter.value === 'done') list = list.filter((t) => t.completed)
  if (tagFilter.value) list = list.filter((t) => (t.tagIds || []).includes(tagFilter.value))
  return list
})

function tText(t) {
  return todoTimeText(t)
}

function tLate(t) {
  return todoOverdue(t, Date.now())
}

function openTaskDrawer(t) {
  taskDrawerId.value = t.id
}

function openEditTask(todo) {
  taskDrawerId.value = null
  formTodo.value = todo
  formParentId.value = null
  formPreset.value = null
  editOpen.value = true
}

function openAddTask() {
  formTodo.value = null
  formParentId.value = null
  formPreset.value = null
  editOpen.value = true
}

function openAddSub(parentTodo) {
  taskDrawerId.value = null
  formTodo.value = null
  formParentId.value = parentTodo.id
  formPreset.value = null
  editOpen.value = true
}

function openEditProject() {
  formProject.value = project.value
  editOpen.value = true
}

function startFocus(t) {
  store.openFocus({ mode: 'pomodoro', targetType: 'todo', targetId: t.id })
}

async function doArchive() {
  const ok = await askConfirm({ title: '归档项目', message: `「${project.value.name}」的全部任务已完成，归档该项目？` })
  if (!ok) return
  store.archiveProject(project.value.id)
  showToast('项目已归档')
}

function reopenProject() {
  store.updateProject(project.value.id, { completed: false, completedAt: null })
  showToast('项目已重新打开')
}

async function doDelete() {
  const n = stats.value.total
  const ok = await askConfirm({
    title: '删除项目',
    message: `确定删除「${project.value.name}」吗？`,
    detail: n ? `将同时删除 ${n} 个任务及其子任务。` : '此操作不可恢复。',
    danger: true,
    okText: '删除',
  })
  if (!ok) return
  store.deleteProject(project.value.id)
  showToast('项目已删除')
  router.push('/projects')
}
</script>

<style scoped>
.bp-chip {
  font-size: 11.5px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.detail-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.head-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wrap {
  flex-wrap: wrap;
}

.type-badge {
  font-size: 11.5px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 999px;
}

.type-badge.study {
  background: color-mix(in srgb, var(--primary) 45%, transparent);
  color: var(--primary-deep);
}

.type-badge.work {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent-deep);
}

.late {
  color: var(--danger);
  font-weight: 700;
  font-size: 12.5px;
}

.done-chip {
  color: var(--success);
  font-size: 12.5px;
  font-weight: 700;
}

.p-name {
  margin: 6px 0 0;
  font-size: 20px;
}

.p-desc {
  margin: 4px 0 0;
  color: var(--text-dim);
  font-size: 13.5px;
  white-space: pre-wrap;
}

.actions {
  flex-wrap: wrap;
}

.icon-btn.danger {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

.meta-row {
  flex-wrap: wrap;
}

.due-text {
  font-size: 13px;
  color: var(--warn);
  font-weight: 600;
}

.due-text.late {
  color: var(--danger);
}

.progress-row {
  gap: 10px;
}

.pct {
  font-size: 14px;
  font-weight: 800;
  color: var(--primary-deep);
}

.toolbar {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.filter-row {
  flex-wrap: wrap;
}

.select-sm {
  width: auto;
  min-width: 100px;
  padding: 5px 10px;
  font-size: 13px;
}

.count {
  margin-left: auto;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 11px;
}

.sub-cell {
  position: relative;
  padding: 12px 12px 9px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.1s ease;
}

.sub-cell:active {
  transform: scale(0.97);
}

.status-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}

.status-bar.s-open {
  background: var(--primary-deep);
}

.status-bar.s-done {
  background: var(--success);
}

.pri-bar2 {
  position: absolute;
  left: 5px;
  top: 10px;
  width: 4px;
  bottom: auto;
  height: 22px;
  border-radius: 3px;
}

.pri-bar2.pri-high {
  background: #ef4444;
}

.pri-bar2.pri-medium {
  background: #eab308;
}

.pri-bar2.pri-low {
  background: #3b82f6;
}

.status-text {
  font-size: 11px;
  color: var(--text-dim);
  font-weight: 700;
}

.status-text.done {
  color: var(--success);
}

.check {
  width: 21px;
  height: 21px;
  border-radius: 50%;
  border: 2px solid var(--line);
  background: var(--card);
  color: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.check.on {
  background: var(--success);
  border-color: var(--success);
  color: #fff;
}

.cell-name {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.cell-name.done {
  color: var(--text-dim);
  text-decoration: line-through;
}

.cell-meta {
  flex-wrap: wrap;
}

.due-mini {
  font-size: 11px;
  color: var(--text-dim);
}

.due-mini.late {
  color: var(--danger);
  font-weight: 700;
}

.cell-foot {
  border-top: 1px dashed var(--line);
  padding-top: 7px;
}

.focus-mini {
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  flex: none;
}

.list {
  overflow: hidden;
}

.list-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
}

.list-row:last-child {
  border-bottom: none;
}

.list-main {
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.list-name {
  font-size: 14.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-name.done {
  color: var(--text-dim);
  text-decoration: line-through;
}
</style>
