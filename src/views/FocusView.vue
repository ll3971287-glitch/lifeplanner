<template>
  <div class="focus-view">
    <section class="timer-card card">
      <FocusTimer />
      <div class="target-tools">
        <button type="button" class="btn btn-outline btn-sm" :disabled="busy" @click="pickerOpen = true">
          <Icon name="tag" :size="14" /> {{ targetDesc || '选择要专注的任务' }}
        </button>
      </div>
    </section>

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
          <span class="mode-tag" :class="s.mode">{{ s.mode === 'pomodoro' ? '番茄' : '自由' }}</span>
          <span class="ses-name">{{ targetNameOf(s) }}</span>
          <span class="muted ses-time">{{ fmtTime(s.startAt) }} · {{ fmtDurationMin(s.durationMin) }}</span>
        </div>
      </div>
      <p v-else class="muted empty-tip">今天还没有专注记录，开始第一个番茄吧。</p>
    </section>

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
import FocusTimer from '../components/focus/FocusTimer.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import Icon from '../components/ui/Icon.vue'

const pickerOpen = ref(false)

const busy = computed(() => store.focusState.phase === 'run' || store.focusState.phase === 'pause')

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

function pickNone() {
  store.setFocusTarget('none', null)
  pickerOpen.value = false
}
</script>

<style scoped>
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
  margin-top: 4px;
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
