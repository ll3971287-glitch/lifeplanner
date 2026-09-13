<template>
  <div class="timer" :class="'phase-' + f.phase">
    <div v-if="title" class="target-name">{{ title }}</div>

    <div class="ring-wrap">
      <svg class="ring" viewBox="0 0 200 200">
        <circle class="ring-track" cx="100" cy="100" r="88" />
        <circle
          class="ring-progress"
          cx="100"
          cy="100"
          r="88"
          :style="{ strokeDashoffset: ringOffset }"
        />
      </svg>
      <div class="ring-center">
        <div class="big-time">{{ displayTime }}</div>
        <div class="phase-text">{{ phaseText }}</div>
      </div>
    </div>

    <div v-if="compact === false" class="mode-seg">
      <SegControl
        :model-value="f.mode"
        :options="[{ label: '番茄钟', value: 'pomodoro' }, { label: '自由计时', value: 'free' }]"
        @update:model-value="store.setFocusMode($event)"
      />
    </div>

    <div class="controls">
      <template v-if="f.phase === 'idle'">
        <button type="button" class="btn btn-lg btn-accent big" @click="start">
          <Icon name="play" :size="18" /> 开始{{ f.mode === 'pomodoro' ? '番茄' : '计时' }}
        </button>
      </template>
      <template v-else-if="f.phase === 'run'">
        <button type="button" class="ctl-btn" @click="store.pauseFocusRun()">
          <Icon name="pause" :size="17" /> 暂停
        </button>
        <button type="button" class="ctl-btn ghost" @click="finish('free')">
          <Icon name="stop" :size="17" /> 结束
        </button>
      </template>
      <template v-else-if="f.phase === 'pause'">
        <button type="button" class="ctl-btn" @click="store.resumeFocusRun()">
          <Icon name="play" :size="17" /> 继续
        </button>
        <button type="button" class="ctl-btn ghost" @click="finish('free')">
          <Icon name="stop" :size="17" /> 结束
        </button>
      </template>
      <template v-else-if="f.phase === 'break'">
        <button type="button" class="ctl-btn" @click="store.skipBreak()">
          <Icon name="check" :size="17" /> 跳过休息
        </button>
      </template>
    </div>

    <div v-if="compact === false" class="today-mini muted">
      今日已专注 {{ todayStats.count }} 次 · {{ fmtDurationMin(todayStats.minutes) }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { store } from '../../store.js'
import { todayFocusStats } from '../../selectors.js'
import { fmtDurationMin } from '../../utils/date.js'
import { pad } from '../../utils/date.js'
import Icon from '../ui/Icon.vue'
import SegControl from '../ui/SegControl.vue'
import { askConfirm } from '../../ui.js'

const props = defineProps({
  compact: { type: Boolean, default: false },
})

const nowMs = ref(Date.now())
let timer = null

onMounted(() => {
  timer = setInterval(() => {
    const t = Date.now()
    store.focusTick(t)
    nowMs.value = t
  }, 1000)
})

onBeforeUnmount(() => clearInterval(timer))

const f = computed(() => store.focusState)

const title = computed(() => {
  if (f.value.targetType === 'checkin') {
    const c = store.state.checkins.find((x) => x.id === f.value.targetId)
    return c ? `专注：${c.name}（打卡）` : '专注打卡'
  }
  if (f.value.targetType === 'todo') {
    const t = store.state.todos.find((x) => x.id === f.value.targetId)
    return t ? `专注：${t.title}` : '专注任务'
  }
  if (f.value.targetType === 'projectSub') {
    const t = store.state.todos.find((x) => x.id === f.value.targetId)
    return t ? `专注：${t.title}（项目任务）` : '专注任务'
  }
  return ''
})

const planMs = computed(() => store.state.settings.pomodoroFocusMin * 60000)
const breakMs = computed(() => store.state.settings.pomodoroBreakMin * 60000)

const elapsedMs = computed(() => store.focusElapsedMs(nowMs.value))

const breakRemain = computed(() => {
  if (f.value.phase !== 'break') return 0
  return Math.max(0, breakMs.value - (nowMs.value - f.value.breakStartTs))
})

const remainMs = computed(() => Math.max(0, planMs.value - elapsedMs.value))

function fmtClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

const displayTime = computed(() => {
  if (f.value.phase === 'break') return fmtClock(breakRemain.value)
  if (f.value.mode === 'pomodoro' && f.value.phase !== 'free') return fmtClock(remainMs.value)
  return fmtClock(elapsedMs.value)
})

const phaseText = computed(() => {
  if (f.value.phase === 'break') return '休息一下 ☕'
  if (f.value.phase === 'run') return f.value.mode === 'pomodoro' ? '专注中' : '计时中'
  if (f.value.phase === 'pause') return '已暂停'
  return f.value.mode === 'pomodoro' ? `${store.state.settings.pomodoroFocusMin} 分钟番茄，准备好了吗` : '自由计时，随时开始'
})

const ringOffset = computed(() => {
  if (f.value.mode !== 'pomodoro' || f.value.phase === 'break') return 0
  const total = planMs.value
  const remain = Math.max(0, remainMs.value)
  const ratio = total ? remain / total : 1
  return String(Math.round(553 * ratio))
})

const todayStats = computed(() => todayFocusStats(store.state.sessions, Date.now()))

function start() {
  store.startFocusRun({ mode: f.value.mode })
}

async function finish(kind) {
  const ok = await askConfirm({
    title: kind === 'free' ? '结束本次专注' : '完成本次番茄',
    message: f.value.mode === 'pomodoro' && f.value.phase === 'run' ? '番茄还没到点，结束会按已专注时长记录。确定结束？' : '结束后将保存本次专注记录。',
    okText: '结束',
  })
  if (!ok) return
  store.endFocusRun({})
}
</script>

<style scoped>
.timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 8px 0;
}

.target-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  max-width: 80vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: color-mix(in srgb, var(--primary) 30%, transparent);
  color: var(--primary-deep);
  padding: 4px 14px;
  border-radius: 999px;
}

.ring-wrap {
  position: relative;
  width: 230px;
  height: 230px;
}

.ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-track {
  fill: none;
  stroke: rgba(0, 0, 0, 0.06);
  stroke-width: 10;
}

.ring-progress {
  fill: none;
  stroke: var(--accent-deep);
  stroke-width: 10;
  stroke-linecap: round;
  stroke-dasharray: 553;
  transition: stroke-dashoffset 0.9s linear;
}

.phase-break .ring-progress {
  stroke: var(--accent-deep);
}

.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.big-time {
  font-size: 46px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 1px;
  line-height: 1;
}

.phase-text {
  font-size: 13px;
  color: var(--text-dim);
}

.controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.big {
  padding: 13px 34px;
  font-size: 16px;
  border-radius: 999px;
}

.ctl-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border-radius: 999px;
  background: var(--primary);
  color: var(--primary-deep);
  font-weight: 700;
  font-size: 14px;
}

.ctl-btn.ghost {
  background: rgba(0, 0, 0, 0.06);
  color: var(--text-dim);
}

.today-mini {
  font-size: 12.5px;
}
</style>
