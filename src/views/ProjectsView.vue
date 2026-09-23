<template>
  <div class="projects-view">
    <div class="toolbar card">
      <div class="cat-bar">
        <SegControl :model-value="catTab" :options="catOptions" @update:model-value="catTab = $event" />
      </div>
      <div class="row-between gap8 wrap">
        <SegControl :model-value="filter" :options="filterOptions" @update:model-value="filter = $event" />
        <button type="button" class="btn btn-primary" @click="openCreate">
          <Icon name="plus" :size="16" /> 新建项目
        </button>
      </div>
    </div>

    <template v-if="activeList.length">
      <div class="grid">
        <button v-for="p in activeList" :key="p.id" type="button" class="p-card card" @click="router.push(`/projects/${p.id}`)">
          <div class="p-head">
            <button
              type="button"
              class="type-badge cat-badge"
              :style="{ background: catColor(p) }"
              :title="'点击调整分类（当前：' + catLabelOfKey(catOf(p)) + '）'"
              @click.stop="openCatPick(p)"
            >
              {{ catMeta(p).short }}
            </button>
            <span v-if="isOverdue(p)" class="late">已逾期</span>
          </div>
          <h3 class="p-name" :title="p.name">{{ p.name }}</h3>
          <p v-if="p.desc" class="p-desc desc-clamp" :title="p.desc">{{ p.desc }}</p>
          <div class="row gap8 meta-row">
            <span class="muted">{{ progressTextOf(p) }}</span>
            <span v-if="p.totalWorkload > 0" class="muted">{{ p.totalWorkload }}{{ p.workloadUnit }}</span>
            <span v-if="p.deadline" class="due" :class="{ soon: isSoon(p) }">{{ deadlineText(p.deadline) }}</span>
          </div>
          <div class="prog-slot">
            <ProgressBar :value="statsOf(p).pct" />
          </div>
          <div class="p-foot row-between">
            <span class="pct">{{ statsOf(p).pct }}%</span>
            <TagChips :tag-ids="p.tagIds" />
          </div>
        </button>
      </div>
    </template>
    <EmptyState v-else-if="!store.state.projects.length" icon="briefcase" text="还没有项目" hint="创建一个学习或工作项目，拆分子任务来推进">
      <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="openCreate">
        <Icon name="plus" :size="16" /> 新建第一个项目
      </button>
    </EmptyState>
    <EmptyState v-else-if="!store.state.projects.filter(inCat).length" icon="briefcase" :text="catLabelOfKey(catTab) + '下还没有项目'" hint="点右上「新建项目」，或把已有项目的分类改到这里">
      <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="openCreate">
        <Icon name="plus" :size="16" /> 新建项目
      </button>
    </EmptyState>
    <EmptyState v-else-if="!archivedList.length" icon="checkCircle" text="该分类没有进行中的项目" hint="全部项目都已完成或归档" />

    <div v-if="archivedList.length" class="archived">
      <button type="button" class="arch-head" @click="archOpen = !archOpen">
        <span>已完成（{{ archivedList.length }}）</span>
        <Icon :name="archOpen ? 'chevronDown' : 'chevronRight'" :size="15" />
      </button>
      <template v-if="archOpen">
        <div class="grid">
          <button v-for="p in archivedList" :key="p.id" type="button" class="p-card card archived-card" @click="router.push(`/projects/${p.id}`)">
            <h3 class="p-name">{{ p.name }}</h3>
            <div class="row gap8 meta-row">
              <span class="muted">{{ progressTextOf(p) }}</span>
              <span class="done-text">已完成</span>
            </div>
          </button>
        </div>
      </template>
    </div>

    <BaseModal :open="catPick.open" title="调整项目分类" @close="catPick.open = false">
      <div class="cat-pick">
        <p class="muted cat-pick-tip">{{ catPick.project ? catPick.project.name : '' }}</p>
        <button
          v-for="c in PROJECT_CATS"
          :key="c.key"
          type="button"
          class="cat-opt"
          :class="{ on: catPick.project && catOf(catPick.project) === c.key }"
          @click="setCat(c.key)"
        >
          <i class="cat-dot" :style="{ background: c.color }" />
          <span class="cat-opt-name">{{ c.label }}</span>
          <span class="muted mini">{{ catCount(c.key) }} 个</span>
        </button>
      </div>
    </BaseModal>

    <BaseModal :open="form.open" :title="form.project ? '编辑项目' : '新建项目'" @close="form.open = false">
      <ProjectFormModal v-if="form.open" :open="form.open" :project="form.project" @close="form.open = false" @saved="form.open = false" />
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../store.js'
import { activeProjects, archivedProjects, projectStats, projectOverdue, projectProgressText } from '../selectors.js'
import { deadlineText } from '../format.js'
import { showToast } from '../ui.js'
import { startOfDayTs, addDaysTs } from '../utils/date.js'
import Icon from '../components/ui/Icon.vue'
import SegControl from '../components/ui/SegControl.vue'
import ProgressBar from '../components/ui/ProgressBar.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import TagChips from '../components/ui/TagChips.vue'
import ProjectFormModal from '../components/project/ProjectFormModal.vue'
import { PROJECT_CATS, catOf, catMeta, catColor, catLabelOfKey } from '../projectMeta.js'

const router = useRouter()

const filter = ref('active')
const catTab = ref('study')
const archOpen = ref(false)
const catPick = ref({ open: false, project: null })

const inCat = (p) => catOf(p) === catTab.value
function catCount(key) {
  return store.state.projects.filter((p) => catOf(p) === key).length
}
const catOptions = computed(() =>
  PROJECT_CATS.map((c) => ({ label: `${c.label} ${catCount(c.key)}`, value: c.key }))
)
function openCatPick(p) {
  catPick.value = { open: true, project: p }
}
function setCat(key) {
  if (catPick.value.project) store.updateProject(catPick.value.project.id, { category: key })
  catPick.value.open = false
  showToast('已调整分类')
}
const form = ref({ open: false, project: null })

const filterOptions = [
  { label: '进行中', value: 'active' },
  { label: '已完成', value: 'done' },
  { label: '全部', value: 'all' },
]

const activeList = computed(() => {
  const list = activeProjects(store.state).filter(inCat)
  if (filter.value === 'done') return []
  if (filter.value === 'all') return [...list, ...archivedProjects(store.state).filter(inCat)]
  return list
})

const archivedList = computed(() => archivedProjects(store.state).filter(inCat))

function statsOf(p) {
  return projectStats(store.state, p.id)
}

function progressTextOf(p) {
  return projectProgressText(store.state, p.id)
}

function isOverdue(p) {
  return projectOverdue(p, Date.now())
}

function isSoon(p) {
  return !isOverdue(p) && p.deadline != null && p.deadline <= addDaysTs(startOfDayTs(Date.now()), 3)
}

function openCreate() {
  form.value = { open: true, project: null }
}
</script>

<style scoped>
.projects-view {
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

.cat-bar {
  display: flex;
}

.cat-badge {
  border: none;
  color: #fff;
  cursor: pointer;
}

.cat-pick {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cat-pick-tip {
  margin: 0 0 4px;
  font-size: 13px;
}

.cat-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--panel);
  font-size: 14.5px;
  text-align: left;
}

.cat-opt.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  font-weight: 700;
}

.cat-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
}

.cat-opt-name {
  flex: 1;
}

.wrap {
  flex-wrap: wrap;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 12px;
}

.p-card {
  text-align: left;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  cursor: pointer;
  min-width: 0;
  transition: transform 0.1s ease;
}

.p-card:active {
  transform: scale(0.98);
}

.p-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  font-size: 12px;
  font-weight: 700;
  color: var(--danger);
}

.p-name {
  margin: 0;
  font-size: 16px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-dim);
  min-width: 0;
  word-break: break-word;
}

.desc-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.prog-slot {
  display: flex;
  align-items: center;
  min-width: 0;
}

.prog-slot :deep(.progress) {
  flex: 1 1 60px;
  min-width: 60px;
}

.meta-row {
  flex-wrap: wrap;
  min-width: 0;
}

.due {
  font-size: 12.5px;
  color: var(--warn);
  font-weight: 600;
}

.due.soon {
  color: var(--danger);
}

.p-foot {
  gap: 8px;
}

.pct {
  font-size: 13px;
  font-weight: 800;
  color: var(--primary-deep);
}

.done-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--success);
}

.archived {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.arch-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-dim);
  padding: 6px 2px;
}

.archived-card {
  opacity: 0.75;
}
</style>
