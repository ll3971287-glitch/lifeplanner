<template>
  <div class="bp-view">
    <div class="toolbar card">
      <div class="row-between gap8 wrap">
        <SegControl :model-value="view" :options="viewOptions" @update:model-value="view = $event" />
        <div class="row gap8">
          <button type="button" class="btn btn-outline btn-sm" @click="dimOpen = true">
            <Icon name="tag" :size="13" /> 管理维度
          </button>
          <button type="button" class="btn btn-primary btn-sm" @click="openCreate">
            <Icon name="plus" :size="14" /> 新建蓝图
          </button>
        </div>
      </div>

      <div v-if="blueprints.length" class="stats row gap6 wrap">
        <button
          type="button"
          class="dim-stat"
          :class="{ on: dimFilter === '' }"
          :style="dimFilter === '' ? {} : {}"
          @click="dimFilter = ''"
        >
          全部 {{ blueprints.length }}
        </button>
        <button
          v-for="d in allDimsList"
          :key="d.id"
          type="button"
          class="dim-stat"
          :class="{ on: dimFilter === d.id }"
          @click="dimFilter = dimFilter === d.id ? '' : d.id"
        >
          <i class="dot" :style="{ background: d.color }" /> {{ d.label }} {{ dimCount(d.id) }}
        </button>
        <button type="button" class="dim-stat" :class="{ on: dimFilter === '__none' }" @click="dimFilter = dimFilter === '__none' ? '' : '__none'">
          <i class="dot gray" /> 未分组 {{ dimCount('__none') }}
        </button>
      </div>

      <div class="row gap8 filters">
        <select v-model="statusFilter" class="select select-sm">
          <option value="">全部状态</option>
          <option v-for="k in statusOrder" :key="k" :value="k">{{ statusOf(k).label }}</option>
        </select>
        <span class="muted count-text">{{ filtered.length }} 个构想</span>
      </div>
    </div>

    <!-- 卡片列表视图 -->
    <template v-if="view === 'cards'">
      <div v-if="filtered.length" class="grid">
        <button v-for="b in filtered" :key="b.id" type="button" class="card bp-card" @click="openDrawer(b.id)">
          <div class="row gap6 c-head">
            <span class="dim-dot" :style="{ background: colorOf(b) }" />
            <span class="bp-title">{{ b.title }}</span>
          </div>
          <div class="row gap6 wrap c-meta">
            <span class="st-chip" :class="statusOf(b.status).cls">{{ statusOf(b.status).label }}</span>
            <span class="muted mini goal"><Icon name="flag" :size="11" /> {{ expectedText(b) }}</span>
          </div>
          <p v-if="b.desc" class="desc">{{ b.desc }}</p>
        </button>
      </div>
      <EmptyState v-else icon="flag" :text="blueprints.length ? '没有匹配的蓝图' : '还没有未来蓝图'" :hint="blueprints.length ? '试试调整筛选条件' : '把远期目标、愿望、构想先存到这里，需要执行时再拆解成项目或任务'">
        <button v-if="!blueprints.length" type="button" class="btn btn-primary" style="margin-top: 14px" @click="openCreate">
          <Icon name="plus" :size="15" /> 写下第一个蓝图
        </button>
      </EmptyState>
    </template>

    <!-- 时间轴视图：以半年为格的可拖动时间轴 -->
    <template v-else>
      <EmptyState v-if="!filtered.length" icon="calendar" text="时间轴为空" hint="筛选条件下没有可展示的蓝图" />
      <BlueprintTimeline v-else :items="filtered" @open="openDrawer" />
    </template>

    <BlueprintDrawer :open="drawerOpen" :bp-id="activeId" @close="closeDrawer" @edit="openEdit" />
    <BlueprintFormModal :open="form.open" :blueprint="form.bp" @close="form.open = false" @saved="onSaved" />
    <BaseModal :open="dimOpen" title="管理人生维度" @close="dimOpen = false">
      <p class="muted dim-hint">蓝图不使用标签，用人生维度分组。内置维度之外可自行添加。</p>
      <div class="row gap6 add-row">
        <input v-model="newDimName" class="input grow" placeholder="新维度名称" @keyup.enter="addDim" />
        <button type="button" class="btn btn-primary btn-sm" @click="addDim">添加</button>
      </div>
      <div class="dim-list">
        <div v-for="d in customDims" :key="d.id" class="dim-row">
          <i class="dot" :style="{ background: colorOfDim(d.id) }" />
          <span class="grow">{{ d.name }}</span>
          <span class="muted mini">{{ dimCount(d.id) }} 个蓝图</span>
          <button type="button" class="mini del" title="删除维度" @click="removeDim(d)">
            <Icon name="x" :size="13" />
          </button>
        </div>
        <p v-if="!customDims.length" class="muted empty-line">还没有自定义维度</p>
      </div>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { store } from '../store.js'
import {
  BUILTIN_DIMS,
  BLUEPRINT_STATUS,
  STATUS_ORDER,
  dimLabel,
  dimColor,
  goalStart,
  goalEnd,
} from '../blueprintMeta.js'
import { fmtDate } from '../utils/date.js'
import { askConfirm, showToast } from '../ui.js'
import Icon from '../components/ui/Icon.vue'
import SegControl from '../components/ui/SegControl.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import BlueprintDrawer from '../components/blueprint/BlueprintDrawer.vue'
import BlueprintFormModal from '../components/blueprint/BlueprintFormModal.vue'
import BlueprintTimeline from '../components/blueprint/BlueprintTimeline.vue'

const viewOptions = [
  { label: '卡片列表', value: 'cards' },
  { label: '时间轴', value: 'timeline' },
]

const view = ref('cards')
const dimFilter = ref('')
const statusFilter = ref('')
const statusOf = (k) => BLUEPRINT_STATUS[k] || BLUEPRINT_STATUS.idea
const statusOrder = STATUS_ORDER

const blueprints = computed(() => [...store.state.blueprints].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
const allDimsList = computed(() => [...BUILTIN_DIMS, ...(store.state.settings.blueprintDims || [])])
const customDims = computed(() => store.state.settings.blueprintDims || [])

function colorOf(b) {
  return b.dimension ? dimColor(b.dimension, store.state.settings.blueprintDims) : '#9ca3af'
}
function colorOfDim(id) {
  return dimColor(id, store.state.settings.blueprintDims)
}

function dimCount(id) {
  if (id === '__none') return blueprints.value.filter((b) => !b.dimension).length
  return blueprints.value.filter((b) => b.dimension === id).length
}

function expectedText(b) {
  const startTs = goalStart(b)
  const endTs = goalEnd(b)
  const parts = []
  if (endTs != null) {
    parts.push(startTs != null ? `${fmtDate(startTs)} ~ ${fmtDate(endTs)}` : `${fmtDate(endTs)} 前`)
  }
  if (b.goalText) parts.push(b.goalText)
  return parts.length ? `期望 ${parts.join(' · ')}` : '时间未定'
}
const filtered = computed(() => {
  return blueprints.value.filter((b) => {
    if (dimFilter.value === '__none' && b.dimension) return false
    if (dimFilter.value && dimFilter.value !== '__none' && b.dimension !== dimFilter.value) return false
    if (statusFilter.value && b.status !== statusFilter.value) return false
    return true
  })
})


// 详情 / 表单
const drawerOpen = ref(false)
const activeId = ref(null)
const form = ref({ open: false, bp: null })

function openDrawer(id) {
  activeId.value = id
  drawerOpen.value = true
}
function closeDrawer() {
  drawerOpen.value = false
}
function openCreate() {
  form.value = { open: true, bp: null }
}
function openEdit(bp) {
  drawerOpen.value = false
  form.value = { open: true, bp }
}
function onSaved() {
  form.value.open = false
}

// 维度管理
const dimOpen = ref(false)
const newDimName = ref('')
function addDim() {
  const d = store.addBlueprintDimension(newDimName.value)
  if (!d) {
    showToast('维度已存在或名称为空', 'err')
    return
  }
  newDimName.value = ''
  showToast('已添加维度')
}
async function removeDim(d) {
  const n = dimCount(d.id)
  const ok = await askConfirm({
    title: '删除维度',
    message: `删除「${d.name}」？${n ? `该维度下 ${n} 个蓝图将变为「未分组」。` : ''}`,
    danger: true,
    okText: '删除',
  })
  if (!ok) return
  store.removeBlueprintDimension(d.id)
  showToast('已删除维度')
}
</script>

<style scoped>
.bp-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stats {
  display: flex;
}

.dim-stat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  padding: 4px 11px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--muted);
}

.dim-stat.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--text);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}

.dot.gray {
  background: #9ca3af;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.bp-card {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  align-items: stretch;
}

.c-head {
  align-items: center;
}

.dim-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
}

.bp-title {
  font-size: 15px;
  font-weight: 800;
  line-height: 1.35;
}

.st-chip {
  font-size: 11.5px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
  flex: none;
}

.st-chip.idea {
  background: color-mix(in srgb, var(--primary) 16%, transparent);
  color: var(--primary-deep);
}

.st-chip.doing {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
}

.st-chip.paused {
  background: var(--line);
  color: var(--muted);
}

.st-chip.done {
  background: color-mix(in srgb, var(--success) 16%, transparent);
  color: var(--success);
}

.goal {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.desc {
  margin: 0;
  font-size: 12.5px;
  color: var(--muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dim-hint {
  margin: 0 0 10px;
  font-size: 12.5px;
}

.add-row {
  margin-bottom: 8px;
}

.input {
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
}

.grow {
  flex: 1;
}

.dim-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 260px;
  overflow: auto;
}

.dim-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 4px;
  border-bottom: 1px dashed var(--line);
  font-size: 14px;
}

.mini.del {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  color: var(--muted);
}

.mini.del:hover {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

.empty-line {
  text-align: center;
  font-size: 13px;
  padding: 10px 0;
}
</style>
