<template>
  <div class="focus-view">
    <section class="timer-card card">
      <div class="row-between timer-top">
        <span class="muted mini">番茄钟 · 自由计时</span>
        <button type="button" class="pomo-btn" title="调整番茄专注时长" @click="pomoOpen = true">
          <Icon name="clock" :size="13" /> 番茄 {{ store.state.settings.pomodoroFocusMin }} 分钟
        </button>
      </div>
      <FocusTimer />
      <div class="target-tools">
        <button type="button" class="btn btn-primary btn-sm" @click="openBackfill">
          <Icon name="timer" :size="14" /> 补记打卡
        </button>
        <button type="button" class="btn btn-outline btn-sm" :disabled="busy" @click="pickerOpen = true">
          <Icon name="tag" :size="14" /> {{ targetDesc || '选择要专注的任务' }}
        </button>
      </div>
    </section>

    <section class="card backfill-summary">
      <div class="row-between">
        <span class="bf-title"><Icon name="sparkles" :size="14" /> 补记打卡</span>
        <span class="bf-coin muted">每 15 分钟 = 15 金币</span>
      </div>
      <p class="muted mini bf-desc">忘记计时了？按「向前多少分钟」补一段专注记录，会计入今日时长与金币。</p>
    </section>

    <FocusChainCard @start="startFromChain" />

    <section class="stats-row">
      <div class="stat card">
        <span class="num">{{ todayStats.count }}</span>
        <span class="lab">今日次数</span>
      </div>
      <div class="stat card">
        <span class="num">{{ fmtDurationMin(todayStats.minutes) }}</span>
        <span class="lab">今日时长</span>
      </div>
      <div class="stat card">
        <span class="num">{{ goalPct }}%</span>
        <span class="lab">目标 {{ store.state.settings.dailyFocusGoalMin }}m</span>
      </div>
    </section>

    <section class="card list-card">
      <h3 class="sec-title">今日专注记录</h3>
      <div v-if="todayList.length" class="session-list">
        <div v-for="s in todayList" :key="s.id" class="session-row">
          <span class="mode-tag" :class="s.mode">{{ modeLabel(s.mode) }}</span>
          <span class="ses-name">{{ targetNameOf(s) }}</span>
          <span class="muted ses-time">{{ fmtTime(s.startAt) }} · {{ fmtDurationMin(s.durationMin) }}</span>
        </div>
      </div>
      <p v-else class="muted empty-tip">今天还没有专注记录，开始第一个番茄吧。</p>
    </section>

    <BaseModal :open="pomoOpen" title="番茄专注时长" @close="pomoOpen = false">
      <div class="pomo-panel">
        <p class="muted mini">选择或输入本轮番茄的专注分钟数（1–180）。</p>
        <div class="row gap6 wrap">
          <button
            v-for="m in [10, 15, 20, 25, 30, 45, 60, 90]"
            :key="m"
            type="button"
            class="pomo-chip"
            :class="{ on: store.state.settings.pomodoroFocusMin === m }"
            @click="setPomo(m)"
          >
            {{ m }} 分钟
          </button>
        </div>
        <div class="row gap8 custom-row">
          <input v-model.number="pomoInput" type="number" min="1" max="180" class="input pomo-input" placeholder="自定义分钟" @keyup.enter="setPomo(pomoInput)" />
          <button type="button" class="btn btn-primary btn-sm" @click="setPomo(pomoInput)">设为该时长</button>
        </div>
      </div>
    </BaseModal>

    <BaseModal :open="backfillOpen" title="补记打卡" @close="backfillOpen = false">
      <div class="bf-panel">
        <p class="muted mini">选择向前补记的时长，系统会生成「当前时刻向前 N 分钟」的专注记录。</p>
        <div class="row gap6 wrap">
          <button
            v-for="m in [15, 30, 45, 60, 90]"
            :key="m"
            type="button"
            class="pomo-chip"
            :class="{ on: backfillMin === m }"
            @click="backfillMin = m"
          >
            向前 {{ m }} 分钟
          </button>
        </div>
        <div class="row gap8 custom-row">
          <input
            v-model.number="backfillMin"
            type="number"
            min="1"
            max="1440"
            class="input pomo-input"
            placeholder="自定义分钟"
            @keyup.enter="saveBackfill"
          />
          <span class="muted mini">分钟</span>
        </div>
        <div class="bf-preview">
          <span class="bf-range">{{ previewRange }}</span>
          <span class="muted mini">共 {{ backfillMinutes || 0 }} 分钟 · 预计 +{{ previewCoins }} 金币</span>
        </div>
        <div class="row gap8" style="justify-content: flex-end">
          <button type="button" class="btn btn-outline btn-sm" @click="backfillOpen = false">取消</button>
          <button type="button" class="btn btn-primary btn-sm" :disabled="!backfillMinutes" @click="saveBackfill">生成记录</button>
        </div>
      </div>
    </BaseModal>

    <BaseModal :open="pickerOpen" title="选择要专注的任务" @close="pickerOpen = false">
      <div class="picker-list">
        <button type="button" class="picker-item" @click="pickNone">
          <span class="picker-name">自由专注（不绑定任务）</span>
        </button>
        <template v-for="t in store.state.todos" :key="t.id">
          <button v-if="!t.completed" type="button" class="picker-item" @click="pick('todo', t.id)">
            <span class="picker-name">{{ t.title }}</span>
            <span v-if="t.timeType !== 'none'" class="muted">{{ shortDate(t.startAt) }}</span>
          </button>
        </template>
        <template v-for="p in store.state.projects" :key="p.id">
          <button
            v-for="s in projectSubTasks(store.state, p.id)"
            :key="s.id"
            v-show="!s.completed"
            type="button"
            class="picker-item"
            @click="pick('todo', s.id)"
          >
            <span class="picker-name sub-name">{{ p.name }} · {{ s.title || s.name }}</span>
          </button>
        </template>
      </div>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store } from '../store.js'
import { todayFocusStats, sessionsOnDay, projectSubTasks } from '../selectors.js'
import { fmtDurationMin, fmtTime, startOfDayTs } from '../utils/date.js'
import { shortDate } from '../format.js'
import { shopRate } from '../rewardMeta.js'
import { showToast } from '../ui.js'
import FocusTimer from '../components/focus/FocusTimer.vue'
import FocusChainCard from '../components/focus/FocusChainCard.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import Icon from '../components/ui/Icon.vue'

const pickerOpen = ref(false)
const pomoOpen = ref(false)
const pomoInput = ref(store.state.settings.pomodoroFocusMin)

function setPomo(m) {
  const v = Math.max(1, Math.min(180, Math.round(Number(m)) || 25))
  store.setSetting('pomodoroFocusMin', v)
  pomoInput.value = v
  pomoOpen.value = false
  showToast(`番茄专注时长已设为 ${v} 分钟`)
}

const busy = computed(() => store.focusState.phase === 'run' || store.focusState.phase === 'pause')

// ---------- 补记打卡 ----------
const backfillOpen = ref(false)
const backfillMin = ref(15)
const backfillAnchorTs = ref(Date.now())

const backfillMinutes = computed(() => {
  const v = Math.round(Number(backfillMin.value) || 0)
  if (v <= 0) return 0
  return Math.min(1440, v)
})

const previewRange = computed(() => {
  const mins = backfillMinutes.value
  if (!mins) return '请输入向前补记的分钟数'
  const end = backfillAnchorTs.value
  return `${fmtTime(end - mins * 60000)} - ${fmtTime(end)}`
})

const previewCoins = computed(() => Math.round(backfillMinutes.value * shopRate(store.state.settings).coinPerFocusMin))

function openBackfill() {
  backfillAnchorTs.value = Date.now()
  backfillMin.value = 15
  backfillOpen.value = true
}

function saveBackfill() {
  const s = store.addManualSession({ minutes: backfillMinutes.value })
  if (!s) {
    showToast('请填写有效的分钟数', 'err')
    return
  }
  backfillOpen.value = false
  showToast(`已补记 ${s.durationMin} 分钟专注（${fmtTime(s.startAt)} - ${fmtTime(s.endAt)}）`)
}

function modeLabel(mode) {
  if (mode === 'pomodoro') return '番茄'
  if (mode === 'manual') return '补记'
  return '自由'
}

const targetDesc = computed(() => {
  const f = store.focusState
  if (f.targetType === 'checkin') {
    const c = store.state.checkins.find((x) => x.id === f.targetId)
    return c ? `${c.name}（打卡）` : ''
  }
  if (f.targetType === 'todo') {
    const t = store.state.todos.find((x) => x.id === f.targetId)
    return t ? t.title : ''
  }
  if (f.targetType === 'projectSub') {
    const t = store.state.todos.find((x) => x.id === f.targetId)
    if (!t) return ''
    const p = t.projectId ? store.state.projects.find((x) => x.id === t.projectId) : null
    return p ? `${p.name} · ${t.title}` : t.title
  }
  return ''
})

const todayStats = computed(() => todayFocusStats(store.state.sessions, Date.now()))
const todayList = computed(() => sessionsOnDay(store.state.sessions, Date.now()).sort((a, b) => b.startAt - a.startAt))

const goalPct = computed(() => {
  const goal = store.state.settings.dailyFocusGoalMin
  if (!goal) return 0
  return Math.min(100, Math.round((todayStats.value.minutes / goal) * 100))
})

function targetNameOf(s) {
  if (s.targetType === 'checkin') {
    const c = store.state.checkins.find((x) => x.id === s.targetId)
    return c ? `${c.name}（打卡）` : '已删除打卡'
  }
  if (s.targetType === 'todo') {
    const t = store.state.todos.find((x) => x.id === s.targetId)
    return t ? t.title : '已删除任务'
  }
  if (s.targetType === 'projectSub') {
    const t = store.state.todos.find((x) => x.id === s.targetId)
    if (!t) return '已删除任务'
    const p = t.projectId ? store.state.projects.find((x) => x.id === t.projectId) : null
    return p ? `${p.name} · ${t.title}` : t.title
  }
  return '自由专注'
}

function pick(type, id) {
  store.setFocusTarget(type, id)
  pickerOpen.value = false
}

// 专注链的「立即专注」：沿用当前计时模式开始一轮专注
function startFromChain() {
  store.startFocusRun({ mode: store.focusState.mode })
}

function pickNone() {
  store.setFocusTarget('none', null)
  pickerOpen.value = false
}
</script>

<style scoped>
.timer-top {
  align-items: center;
  padding: 2px 4px 0;
}

.pomo-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--muted);
}

.pomo-btn:hover {
  border-color: var(--accent);
  color: var(--accent-deep);
}

.pomo-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pomo-chip {
  padding: 6px 13px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--panel);
  font-size: 13px;
  color: var(--muted);
}

.pomo-chip.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--text);
  font-weight: 700;
}

.custom-row {
  align-items: center;
}

.pomo-input {
  width: 130px;
}
.focus-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timer-card {
  padding: 18px 12px 12px;
}

.target-tools {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.backfill-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
}

.bf-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 800;
}

.bf-coin {
  font-size: 11.5px;
}

.bf-desc {
  margin: 0;
}

.bf-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bf-preview {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 11px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--line) 30%, transparent);
}

.bf-range {
  font-size: 15px;
  font-weight: 800;
  color: var(--accent-deep);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 6px;
  gap: 2px;
}

.num {
  font-size: 17px;
  font-weight: 800;
  color: var(--primary-deep);
}

.lab {
  font-size: 11.5px;
  color: var(--text-dim);
}

.list-card {
  padding: 14px;
}

.sec-title {
  margin: 0 0 10px;
  font-size: 15px;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 0;
  border-bottom: 1px dashed var(--line);
}

.mode-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 999px;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  flex: none;
}

.mode-tag.manual {
  color: var(--warn);
  background: color-mix(in srgb, var(--warn) 14%, transparent);
}

.ses-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13.5px;
}

.ses-time {
  flex: none;
}

.empty-tip {
  text-align: center;
  padding: 8px 0;
}

.picker-list {
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  overflow-y: auto;
}

.picker-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 11px 4px;
  border-bottom: 1px solid var(--line);
  text-align: left;
}

.picker-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-name {
  color: var(--text-dim);
  font-size: 13.5px;
}
</style>
