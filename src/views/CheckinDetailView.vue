<template>
  <div v-if="checkin" class="detail-view">
    <header class="head-card card">
      <div class="row-between wrap gap8">
        <div>
          <h2 class="c-name">{{ checkin.name }}</h2>
          <p class="muted c-meta">
            每日 {{ checkin.dailyTargetCount }}{{ checkin.unit }}
            <template v-if="checkin.fixedDurationMin">· 每次 {{ checkin.fixedDurationMin }} 分钟</template>
            <template v-if="checkin.endDate">· {{ fmtDate(checkin.endDate) }} 截止</template>
            <template v-else>· 永久</template>
          </p>
          <span v-if="checkin.endDate" class="cdown" :class="{ over: countdownText(checkin.endDate).startsWith('已结束') }">{{ countdownText(checkin.endDate) }}</span>
        </div>
        <div class="row gap6">
          <button type="button" class="btn btn-primary btn-sm check-now" @click="doCheckin($event.currentTarget)">
            <Icon name="checkCircle" :size="14" /> {{ todayMet ? '再记一次' : '记一次打卡' }}
          </button>
          <button type="button" class="btn btn-outline btn-sm" :disabled="!active" @click="startCheckinFocus">
            <Icon name="alarm" :size="13" /> 专注
          </button>
          <button type="button" class="btn btn-outline btn-sm" @click="editOpen = true">
            <Icon name="edit" :size="13" /> 编辑
          </button>
          <button type="button" class="icon-btn danger" title="删除打卡项目" @click="doDelete">
            <Icon name="trash" :size="16" />
          </button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-box card">
          <span class="num">{{ stats.metDays }}</span>
          <span class="lab">达标天数</span>
        </div>
        <div class="stat-box card">
          <span class="num">{{ stats.metRate }}%</span>
          <span class="lab">达标率</span>
        </div>
        <div class="stat-box card">
          <span class="num">{{ streak }}</span>
          <span class="lab">当前连续</span>
        </div>
        <div class="stat-box card">
          <span class="num">{{ checkin.fixedDurationMin ? totalDuration : totalCounts }}{{ checkin.fixedDurationMin ? ' 分钟' : checkin.unit }}</span>
          <span class="lab">累计{{ checkin.fixedDurationMin ? '时长' : '次数' }}</span>
        </div>
      </div>
    </header>

    <section class="chart-card card">
      <div class="row-between wrap gap8">
        <SegControl :model-value="chartMode" :options="chartOptions" @update:model-value="chartMode = $event" />
        <SegControl v-if="chartMode === 'line'" :model-value="lineDays" :options="[{ label: '30 天', value: 30 }, { label: '90 天', value: 90 }]" @update:model-value="lineDays = $event" />
      </div>
      <LineChart v-if="chartMode === 'line'" :checkin-id="checkin.id" :days="lineDays" />
      <Heatmap v-else-if="chartMode === 'heat'" :checkin-id="checkin.id" />
      <GanttChart v-else :checkin-id="checkin.id" :days="14" :offset-days="ganttOffset" @update:offset="ganttOffset = $event" />
    </section>

    <section class="records-card card">
      <h3 class="sec-title">历史记录（{{ records.length }}）</h3>
      <div v-if="records.length" class="rec-list">
        <div v-for="r in records" :key="r.id" class="rec-row">
          <span class="mode-tag">打卡</span>
          <div class="rec-main">
            <div class="row gap8 rec-line">
              <span>{{ fmtDateTime(r.at) }}</span>
              <span v-if="r.durationMin" class="muted">{{ r.durationMin }} 分钟</span>
              <span v-else class="muted">{{ r.count }} {{ checkin.unit }}</span>
            </div>
            <p v-if="r.note" class="rec-note muted">{{ r.note }}</p>
          </div>
          <button type="button" class="mini-del" @click="delRecord(r)">
            <Icon name="x" :size="13" />
          </button>
        </div>
      </div>
      <p v-else class="muted empty-tip">还没有打卡记录。</p>
    </section>

    <BaseModal :open="editOpen" title="编辑打卡项目" @close="editOpen = false">
      <CheckinFormModal v-if="editOpen" :checkin="checkin" @close="editOpen = false" @saved="editOpen = false" />
    </BaseModal>

    <CheckinRecordModal :open="recordOpen" :checkin-id="checkin.id" @close="recordOpen = false" @recorded="onRecorded" />
  </div>

  <EmptyState v-else icon="checkCircle" text="打卡项目不存在或已删除" hint="返回打卡列表看看">
    <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="router.push('/checkins')">返回打卡</button>
  </EmptyState>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store } from '../store.js'
import {
  indexCheckinRecords,
  checkinStatsRange,
  checkinStreak,
  checkinDayMet,
  checkinActive,
} from '../selectors.js'
import { fmtDateTime, fmtDate, startOfDayTs, DAY_MS } from '../utils/date.js'
import { countdownText } from '../format.js'
import { askConfirm, showToast, randomMotivation, fireConfetti } from '../ui.js'
import { unlockAudio } from '../sound.js'
import Icon from '../components/ui/Icon.vue'
import SegControl from '../components/ui/SegControl.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import CheckinFormModal from '../components/checkin/CheckinFormModal.vue'
import CheckinRecordModal from '../components/checkin/CheckinRecordModal.vue'
import LineChart from '../components/checkin/charts/LineChart.vue'
import Heatmap from '../components/checkin/charts/Heatmap.vue'
import GanttChart from '../components/checkin/charts/GanttChart.vue'

const route = useRoute()
const router = useRouter()

const checkin = computed(() => store.state.checkins.find((c) => c.id === route.params.id) || null)
const map = computed(() => (checkin.value ? indexCheckinRecords(store.state.checkinRecords, checkin.value.id) : {}))

const chartMode = ref('line')
const lineDays = ref(30)
const ganttOffset = ref(0)
const editOpen = ref(false)
const recordOpen = ref(false)

const chartOptions = [
  { label: '折线图', value: 'line' },
  { label: '热力图', value: 'heat' },
  { label: '甘特图', value: 'gantt' },
]

const today = computed(() => startOfDayTs(Date.now()))

const active = computed(() => (checkin.value ? checkinActive(checkin.value, Date.now()) : false))
const todayMet = computed(() => (checkin.value ? checkinDayMet(checkin.value, map.value, today.value) : false))
const streak = computed(() => (checkin.value ? checkinStreak(checkin.value, map.value, Date.now()) : 0))

const records = computed(() =>
  (checkin.value ? store.state.checkinRecords.filter((r) => r.checkinId === checkin.value.id) : []).sort((a, b) => b.at - a.at)
)

const totalCounts = computed(() => records.value.reduce((a, r) => a + (r.count || 0), 0))
const totalDuration = computed(() => records.value.reduce((a, r) => a + (r.durationMin || 0), 0))

const stats = computed(() => {
  if (!checkin.value) return { metDays: 0, metRate: 0 }
  const startTs = checkin.value.startDate != null ? startOfDayTs(checkin.value.startDate) : Math.min(...records.value.map((r) => r.at), Date.now())
  const endTs = (checkin.value.endDate != null ? checkin.value.endDate : Date.now()) + DAY_MS
  return checkinStatsRange(checkin.value, map.value, startTs, endTs)
})

let lastBtn = null

function startCheckinFocus() {
  unlockAudio()
  if (!checkin.value || !active.value) {
    showToast('打卡项目已过期', 'err')
    return
  }
  store.openFocus({ mode: 'pomodoro', targetType: 'checkin', targetId: checkin.value.id })
}

function doCheckin(btn) {
  if (!active.value) {
    showToast('打卡项目已过期', 'err')
    return
  }
  lastBtn = btn || null
  recordOpen.value = true
}

function onRecorded() {
  fireConfetti(lastBtn)
  showToast(randomMotivation())
}

async function delRecord(r) {
  const ok = await askConfirm({ title: '删除记录', message: '删除这条打卡记录？', danger: true, okText: '删除' })
  if (!ok) return
  store.deleteCheckinRecord(r.id)
}

async function doDelete() {
  const ok = await askConfirm({
    title: '删除打卡项目',
    message: `删除「${checkin.value.name}」及全部 ${records.value.length} 条记录？`,
    danger: true,
    okText: '删除',
  })
  if (!ok) return
  store.deleteCheckin(checkin.value.id)
  showToast('已删除')
  router.push('/checkins')
}
</script>

<style scoped>
.detail-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.head-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.c-name {
  margin: 0;
  font-size: 20px;
}

.c-meta {
  margin: 3px 0 0;
}

.cdown {
  align-self: flex-start;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--warn);
  background: color-mix(in srgb, var(--warn) 12%, transparent);
  border-radius: 999px;
  padding: 3px 12px;
}

.cdown.over {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 9px;
}

.stat-box {
  padding: 11px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  box-shadow: none;
}

.num {
  font-size: 19px;
  font-weight: 800;
  color: var(--primary-deep);
}

.lab {
  font-size: 11.5px;
  color: var(--text-dim);
}

.chart-card {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.records-card {
  padding: 14px;
}

.sec-title {
  margin: 0 0 8px;
  font-size: 15px;
}

.rec-list {
  display: flex;
  flex-direction: column;
}

.rec-row {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--line);
  font-size: 13.5px;
}

.rec-main {
  flex: 1;
  min-width: 0;
}

.rec-line {
  gap: 8px;
}

.rec-note {
  margin: 3px 0 0;
  font-size: 12.5px;
  white-space: pre-wrap;
  word-break: break-word;
}

.mode-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 999px;
  color: var(--primary-deep);
  background: color-mix(in srgb, var(--primary) 35%, transparent);
  flex: none;
}

.mini-del {
  margin-left: auto;
  color: var(--text-dim);
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
}

.empty-tip {
  text-align: center;
  padding: 12px 0;
}
</style>
