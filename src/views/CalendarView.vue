<template>
  <div class="cal-view">
    <div class="toolbar card">
      <div class="row-between wrap gap8">
        <SegControl :model-value="view" :options="viewOptions" @update:model-value="view = $event" />
        <div class="row gap6 nav">
          <button type="button" class="icon-btn" aria-label="上一页" @click="prev">
            <Icon name="chevronLeft" :size="17" />
          </button>
          <button type="button" class="btn btn-sm btn-outline" @click="goToday">今天</button>
          <button type="button" class="icon-btn" aria-label="下一页" @click="next">
            <Icon name="chevronRight" :size="17" />
          </button>
        </div>
      </div>
      <h2 class="cal-title">{{ title }}</h2>
    </div>

    <div class="body-card card">
      <TimelineView v-if="view !== 'month'" :days="timelineDays" @create="openCreate" @item-click="openEdit" />
      <MonthView v-else :year="anchorYear" :month="anchorMonth" @day-create="openDayCreate" @item-click="openEdit" />
    </div>

    <p class="tip muted">点空白处可快速新建该时刻的任务，点条目可编辑</p>

    <BaseModal :open="form.open" :title="form.todo ? '编辑任务' : '新建任务'" @close="form.open = false">
      <TodoFormModal
        v-if="form.open"
        :todo="form.todo"
        :preset-time="form.preset"
        @close="form.open = false"
        @saved="form.open = false"
      />
    </BaseModal>
    <BlueprintDrawer :open="bpDrawerOpen" :bp-id="bpId" @close="bpDrawerOpen = false" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store } from '../store.js'
import {
  startOfDayTs,
  addDaysTs,
  addMonthsTs,
  weekDaysTs,
  fmtDate,
  DAY_MS,
  startOfWeekTs,
} from '../utils/date.js'
import { weekdayOf } from '../format.js'
import Icon from '../components/ui/Icon.vue'
import SegControl from '../components/ui/SegControl.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import TimelineView from '../components/calendar/TimelineView.vue'
import MonthView from '../components/calendar/MonthView.vue'
import BlueprintDrawer from '../components/blueprint/BlueprintDrawer.vue'
import TodoFormModal from '../components/todo/TodoFormModal.vue'

// 默认进入月视图
const view = ref('month')
const anchor = ref(Date.now())

const viewOptions = [
  { label: '日', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
]

const form = ref({ open: false, todo: null, preset: null })
const bpDrawerOpen = ref(false)
const bpId = ref(null)

const anchorDay = computed(() => startOfDayTs(anchor.value))

const timelineDays = computed(() => (view.value === 'day' ? [anchorDay.value] : weekDaysTs(anchor.value)))

const anchorYear = computed(() => new Date(anchor.value).getFullYear())
const anchorMonth = computed(() => new Date(anchor.value).getMonth())

const title = computed(() => {
  const d = new Date(anchor.value)
  if (view.value === 'day') return `${fmtDate(anchor.value)} ${weekdayOf(anchor.value)}`
  if (view.value === 'week') {
    const ws = startOfWeekTs(anchor.value)
    return `${fmtDate(ws)} ~ ${fmtDate(ws + 6 * DAY_MS)}`
  }
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`
})

function prev() {
  if (view.value === 'day') anchor.value = addDaysTs(anchor.value, -1)
  else if (view.value === 'week') anchor.value = addDaysTs(anchor.value, -7)
  else anchor.value = addMonthsTs(anchor.value, -1)
}

function next() {
  if (view.value === 'day') anchor.value = addDaysTs(anchor.value, 1)
  else if (view.value === 'week') anchor.value = addDaysTs(anchor.value, 7)
  else anchor.value = addMonthsTs(anchor.value, 1)
}

function goToday() {
  anchor.value = Date.now()
}

function openCreate(ts) {
  form.value = { open: true, todo: null, preset: { timeType: 'datetime', startAt: ts, endAt: null } }
}

function openDayCreate(dayTs) {
  openCreate(dayTs + 9 * 3600000)
}

function openEdit(item) {
  if (item && item.type === 'blueprint') {
    bpId.value = item.bp.id
    bpDrawerOpen.value = true
    return
  }
  form.value = { open: true, todo: item, preset: null }
}
</script>

<style scoped>
.cal-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toolbar {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cal-title {
  margin: 0;
  font-size: 15px;
}

.body-card {
  padding: 6px 0;
  overflow: hidden;
}

.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
}

.icon-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.tip {
  text-align: center;
  font-size: 12px;
  margin: 0;
}
</style>
