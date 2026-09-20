<template>
  <div class="food-view">
    <!-- 提醒条 -->
    <div v-if="alerts.over.length || alerts.near.length" class="card alert-card">
      <span class="alert-item over" v-if="alerts.over.length">
        <Icon name="alert" :size="14" /> 已过期 {{ alerts.over.length }} 项
      </span>
      <span class="alert-item near" v-if="alerts.near.length">
        <Icon name="clock" :size="14" /> 临期 {{ alerts.near.length }} 项
      </span>
      <button type="button" class="btn btn-outline btn-sm alert-btn" @click="showAlertsOnly = !showAlertsOnly">
        {{ showAlertsOnly ? '显示全部' : '只看临期/过期' }}
      </button>
    </div>

    <!-- 统计卡 -->
    <div class="card stat-card">
      <div class="row-between stat-head">
        <h3 class="stat-title"><Icon name="layers" :size="15" /> 食物统计</h3>
        <SegControl :model-value="period" :options="periodOptions" @update:model-value="period = $event" />
      </div>
      <div class="stat-grid">
        <div class="stat-cell">
          <span class="stat-num">{{ stats.consumed }}</span>
          <span class="muted mini">已消耗</span>
        </div>
        <div class="stat-cell">
          <span class="stat-num danger">{{ stats.discarded }}</span>
          <span class="muted mini">已丢弃</span>
        </div>
        <div class="stat-cell">
          <span class="stat-num">{{ storedCount }}</span>
          <span class="muted mini">在库</span>
        </div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar card">
      <div class="row-between gap8 wrap">
        <SegControl :model-value="statusFilter" :options="statusOptions" @update:model-value="statusFilter = $event" />
        <button type="button" class="btn btn-primary btn-sm" @click="openCreate">
          <Icon name="plus" :size="15" /> 添加食物
        </button>
      </div>
      <div class="row gap8 wrap filter-row">
        <select v-model="placeFilter" class="select select-sm">
          <option value="">全部位置</option>
          <option v-for="p in FOOD_PLACES" :key="p.key" :value="p.key">{{ p.label }}</option>
        </select>
        <select v-model="openedFilter" class="select select-sm">
          <option value="">全部开封状态</option>
          <option value="closed">未开封</option>
          <option value="open">已开封</option>
        </select>
        <span class="muted count-text">{{ list.length }} 项</span>
      </div>
    </div>

    <div v-if="list.length" class="list">
      <FoodCard
        v-for="f in list"
        :key="f.id"
        :item="f"
        @edit="openEdit"
        @consume="consume"
        @discard="discard"
        @restore="restore"
        @remove="remove"
      />
    </div>
    <EmptyState
      v-else
      icon="layers"
      :text="emptyText"
      hint="记录食材分类、存放位置与开封状态，系统会按保质期预设自动建议过期时间"
    >
      <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="openCreate">
        <Icon name="plus" :size="15" /> 添加第一件食物
      </button>
    </EmptyState>

    <FoodFormModal :open="form.open" :item="form.item" @close="form.open = false" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store } from '../store.js'
import { foodList, foodAlerts, foodStats } from '../selectors.js'
import { FOOD_PLACES, FOOD_STATUS_ORDER, statusLabel } from '../foodMeta.js'
import Icon from '../components/ui/Icon.vue'
import SegControl from '../components/ui/SegControl.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import FoodCard from '../components/food/FoodCard.vue'
import FoodFormModal from '../components/food/FoodFormModal.vue'
import { startOfWeekTs } from '../utils/date.js'

const period = ref('week')
const periodOptions = [
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
]
const statusFilter = ref('stored')
const statusOptions = FOOD_STATUS_ORDER.map((k) => ({ label: statusLabel(k), value: k }))
const placeFilter = ref('')
const openedFilter = ref('')
const showAlertsOnly = ref(false)

const periodRange = computed(() => {
  const now = Date.now()
  if (period.value === 'week') {
    const ws = startOfWeekTs(now)
    return [ws, ws + 7 * 86400000]
  }
  const d = new Date(now)
  return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()]
})

const baseList = computed(() =>
  foodList(store.state, {
    place: placeFilter.value,
    opened: openedFilter.value === '' ? '' : openedFilter.value === 'open',
    status: statusFilter.value,
  })
)

const alerts = computed(() => foodAlerts(store.state))
const showAlertsOnlySafe = computed(() => showAlertsOnly.value && statusFilter.value === 'stored')

const list = computed(() => {
  if (!showAlertsOnlySafe.value) return baseList.value
  const ids = new Set([...alerts.value.over, ...alerts.value.near].map((f) => f.id))
  return baseList.value.filter((f) => ids.has(f.id))
})

const stats = computed(() => foodStats(store.state, periodRange.value[0], periodRange.value[1]))
const storedCount = computed(() => store.state.foodItems.filter((f) => f.status === 'stored').length)

const emptyText = computed(() => {
  if (showAlertsOnlySafe.value) return '没有临期或过期的食物'
  const label = statusLabel(statusFilter.value)
  return `没有${label}的食物`
})

const form = ref({ open: false, item: null })
function openCreate() {
  form.value = { open: true, item: null }
}
function openEdit(item) {
  form.value = { open: true, item }
}

function consume(f) {
  store.markFoodConsumed(f.id)
}
function discard(f) {
  store.markFoodDiscarded(f.id)
}
function restore(f) {
  store.restoreFood(f.id)
}
function remove(f) {
  store.deleteFood(f.id)
}
</script>

<style scoped>
.food-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alert-card {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.alert-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 800;
}

.alert-item.over {
  color: var(--danger);
}

.alert-item.near {
  color: var(--warn);
}

.alert-btn {
  margin-left: auto;
}

.stat-card {
  padding: 12px 14px;
}

.stat-head {
  align-items: center;
  margin-bottom: 8px;
}

.stat-title {
  margin: 0;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.stat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 8px 4px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--line) 35%, transparent);
}

.stat-num {
  font-size: 18px;
  font-weight: 800;
}

.stat-num.danger {
  color: var(--danger);
}

.toolbar {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filter-row {
  align-items: center;
}

.count-text {
  margin-left: auto;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
