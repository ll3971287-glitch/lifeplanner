<template>
  <div class="checkins-view">
    <div class="toolbar card">
      <div class="row-between gap8 wrap">
        <div>
          <h2 class="page-title">习惯打卡</h2>
          <p v-if="todayMet > 0" class="muted title-sub">今天已完成 {{ todayMet }} 项</p>
        </div>
        <button type="button" class="btn btn-primary" @click="openCreate">
          <Icon name="plus" :size="16" /> 新建打卡
        </button>
      </div>
    </div>

    <template v-if="items.length">
      <div class="list">
        <div
          v-for="it in items"
          :key="it.checkin.id"
          class="c-card card"
          :class="{ expired: !it.active }"
          @click="router.push(`/checkins/${it.checkin.id}`)"
        >
          <div class="c-main">
            <div class="row gap8 c-head">
              <span class="c-name" :class="{ met: it.met }">{{ it.checkin.name }}</span>
              <span v-if="it.met" class="met-badge"><Icon name="check" :size="11" /> 达标</span>
              <span v-if="!it.active" class="exp-badge">已结束</span>
            </div>
            <div class="c-meta muted">
              <span v-if="it.checkin.rule === 'count' && it.checkin.countUnlimited">自由记录（不限次数）</span>
              <span v-else>目标 {{ it.checkin.dailyTargetCount }}{{ it.checkin.unit }}/天</span>
              <template v-if="it.checkin.fixedDurationMin">
                <span>· 每次 {{ it.checkin.fixedDurationMin }} 分钟</span>
              </template>
              <span v-if="it.streak">· 连续 {{ it.streak }} 天</span>
              <span v-if="it.checkin.endDate">· 至 {{ fmtDate(it.checkin.endDate) }}</span>
              <span v-if="it.checkin.endDate" class="cdown" :class="{ over: countdownText(it.checkin.endDate).startsWith('已结束') }">{{ countdownText(it.checkin.endDate) }}</span>
            </div>
            <div class="progress-row row gap8">
              <ProgressBar :value="todayPct(it)" />
              <span class="today-text" :class="{ met: it.met }">
                {{ checkinTodayProgressText(it.checkin, it.stat) }}
              </span>
            </div>
          </div>
          <div class="row gap6 c-actions">
            <button
              type="button"
              class="icon-btn focus-mini"
              :disabled="!it.active"
              title="开始专注打卡"
              @click.stop="focusCheckin(it)"
            >
              <Icon name="alarm" :size="17" />
            </button>
            <button
              type="button"
              class="checkin-btn"
              :class="{ met: it.met }"
              :disabled="!it.active"
              @click.stop="doCheckin(it, $event.currentTarget)"
            >
              <Icon name="checkCircle" :size="18" />
              <span>{{ it.met ? '已完成' : '打卡' }}</span>
            </button>
            <button
              type="button"
              class="icon-btn archive-mini"
              title="归档（移入归档箱，记录与图表保留）"
              @click.stop="archiveIt(it)"
            >
              <Icon name="box" :size="17" />
            </button>
          </div>
        </div>
      </div>
    </template>
    <EmptyState v-else icon="checkCircle" text="还没有打卡项目" hint="建一个习惯，每天打卡并查看趋势图表">
      <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="openCreate">
        <Icon name="plus" :size="16" /> 新建第一个打卡
      </button>
    </EmptyState>

    <!-- 归档箱 -->
    <div v-if="archived.length" class="archived">
      <button type="button" class="arch-head" @click="archOpen = !archOpen">
        <span>归档箱（{{ archived.length }}）</span>
        <Icon :name="archOpen ? 'chevronDown' : 'chevronRight'" :size="15" />
      </button>
      <template v-if="archOpen">
        <div class="arch-list">
          <div v-for="c in archived" :key="c.id" class="arch-row card">
            <div class="arch-main" @click="router.push(`/checkins/${c.id}`)">
              <span class="arch-name">{{ c.name }}</span>
              <span class="muted mini">
                每日 {{ c.dailyTargetCount }}{{ c.unit }}
                <template v-if="c.fixedDurationMin">· 每次 {{ c.fixedDurationMin }} 分钟</template>
                · 归档于 {{ fmtDate(c.archivedAt) }}
              </span>
            </div>
            <button type="button" class="btn btn-outline btn-sm" @click="restoreIt(c)">恢复</button>
          </div>
        </div>
      </template>
    </div>

    <BaseModal :open="form.open" :title="form.checkin ? '编辑打卡' : '新建打卡项目'" @close="form.open = false">
      <CheckinFormModal v-if="form.open" :checkin="form.checkin" @close="form.open = false" @saved="form.open = false" />
    </BaseModal>

    <CheckinRecordModal :open="recordOpen" :checkin-id="recordCheckinId" @close="recordOpen = false" @recorded="onRecorded" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../store.js'
import { checkinTodayList, checkinTodayProgressText, archivedCheckins } from '../selectors.js'
import { fmtDate } from '../utils/date.js'
import { countdownText } from '../format.js'
import Icon from '../components/ui/Icon.vue'
import ProgressBar from '../components/ui/ProgressBar.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import CheckinFormModal from '../components/checkin/CheckinFormModal.vue'
import CheckinRecordModal from '../components/checkin/CheckinRecordModal.vue'
import { askConfirm, goFocus, showToast, randomMotivation, fireConfetti } from '../ui.js'
import { unlockAudio } from '../sound.js'

const router = useRouter()

const form = ref({ open: false, checkin: null })
const archOpen = ref(false)
const recordOpen = ref(false)
const recordCheckinId = ref(null)

const items = computed(() => checkinTodayList(store.state, Date.now()).sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0)))
const todayMet = computed(() => items.value.filter((i) => i.active && i.met).length)

function todayPct(it) {
  const c = it.checkin
  let done = it.stat.counts
  let target = c.dailyTargetCount
  if (c.fixedDurationMin) {
    done = it.stat.totalDuration
    target = c.dailyTargetCount * c.fixedDurationMin
  } else if (c.rule === 'count' && c.countUnlimited) {
    done = Math.min(1, it.stat.counts)
    target = 1
  }
  return Math.min(100, Math.round((done / target) * 100))
}

const archived = computed(() => archivedCheckins(store.state))

async function archiveIt(it) {
  const c = it.checkin
  const ok = await askConfirm({
    title: '归档打卡',
    message: `把「${c.name}」移入归档箱？`,
    detail: '归档后不再出现在打卡列表与今日统计里，历史记录和图表都会保留，可随时恢复。',
    okText: '归档',
  })
  if (!ok) return
  store.archiveCheckin(c.id)
  showToast('已归档，可在归档箱恢复')
}

function restoreIt(c) {
  store.restoreCheckin(c.id)
  showToast('已恢复到打卡列表')
}

function openCreate() {
  form.value = { open: true, checkin: null }
}

let lastBtn = null

function focusCheckin(it) {
  if (!it.active || !it.checkin) return
  unlockAudio()
  goFocus(router, { mode: 'pomodoro', targetType: 'checkin', targetId: it.checkin.id })
}

function doCheckin(it, btn) {
  if (!it.active) return
  lastBtn = btn || null
  const c = it.checkin
  if (c.fixedDurationMin || c.rule === 'count') {
    recordCheckinId.value = c.id
    recordOpen.value = true
  } else {
    store.addCheckinRecord(c.id, { count: 1 })
    showToast(`${randomMotivation()} 已打卡 1 ${c.unit}`)
    fireConfetti(btn)
  }
}

function onRecorded() {
  fireConfetti(lastBtn)
  showToast(randomMotivation())
}
</script>

<style scoped>
.checkins-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  padding: 14px;
}

.archived {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.arch-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-dim);
  padding: 6px 2px;
  text-align: left;
}

.arch-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.arch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
}

.arch-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}

.arch-name {
  font-size: 14.5px;
  font-weight: 700;
}

.archive-mini {
  align-self: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--text-dim);
  display: grid;
  place-items: center;
  flex: none;
}

.archive-mini:active {
  transform: scale(0.94);
}

.archive-mini:hover {
  color: var(--accent-deep);
  border-color: var(--accent);
}

.page-title {
  margin: 0;
  font-size: 18px;
}

.title-sub {
  margin: 2px 0 0;
}

.wrap {
  flex-wrap: wrap;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.c-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  cursor: pointer;
}

.c-card.expired {
  opacity: 0.55;
}

.c-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.c-head {
  flex-wrap: wrap;
}

.c-name {
  font-size: 16px;
  font-weight: 700;
}

.c-name.met {
  color: var(--success);
}

.met-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
  color: var(--success);
  background: color-mix(in srgb, var(--success) 14%, transparent);
  border-radius: 999px;
  padding: 2px 9px;
}

.cdown {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--warn);
  background: color-mix(in srgb, var(--warn) 12%, transparent);
  border-radius: 999px;
  padding: 1px 9px;
}

.cdown.over {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

.exp-badge {
  font-size: 11px;
  color: var(--text-dim);
  background: rgba(0, 0, 0, 0.05);
  border-radius: 999px;
  padding: 2px 9px;
}

.c-meta {
  font-size: 12.5px;
}

.progress-row {
  gap: 10px;
}

.today-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-dim);
  white-space: nowrap;
}

.today-text.met {
  color: var(--success);
}

.focus-mini {
  align-self: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--muted);
  display: grid;
  place-items: center;
  flex: none;
}

.focus-mini:active {
  transform: scale(0.94);
}

.focus-mini:disabled {
  opacity: 0.4;
}

.checkin-btn {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 66px;
  height: 62px;
  border-radius: 16px;
  background: linear-gradient(160deg, var(--primary), color-mix(in srgb, var(--accent) 30%, var(--primary)));
  color: var(--primary-deep);
  font-weight: 800;
  font-size: 13px;
}

.checkin-btn:active {
  transform: scale(0.94);
}

.checkin-btn:disabled {
  opacity: 0.5;
}

.checkin-btn.met {
  background: color-mix(in srgb, var(--success) 15%, transparent);
  color: var(--success);
}
</style>
