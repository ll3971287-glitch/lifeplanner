<template>
  <section class="card chain-card">
    <div class="row-between chain-head">
      <h3 class="sec-title"><Icon name="layers" :size="15" /> 专注链</h3>
      <div class="row gap6">
        <span v-if="phase === 'reserved'" class="countdown-chip">预约倒计时 {{ clock }}</span>
        <button type="button" class="mini-btn" @click="openSettings">
          <Icon name="settings" :size="13" /> 设置
        </button>
      </div>
    </div>

    <!-- 触发信号 -->
    <div class="chain-step" :class="stepClass('trigger')" @click="toggleTrigger">
      <span class="step-icon"><Icon :name="triggerDone ? 'check' : 'alert'" :size="14" /></span>
      <div class="step-main">
        <span class="step-label">触发信号</span>
        <span class="step-text">{{ cfg.triggerText }}</span>
      </div>
      <span class="step-state">{{ triggerStateText }}</span>
    </div>

    <!-- 专注标志 -->
    <div class="chain-step" :class="stepClass('mark')" @click="toggleMark">
      <span class="step-icon"><Icon :name="markDone ? 'check' : 'flag'" :size="14" /></span>
      <div class="step-main">
        <span class="step-label">专注标志</span>
        <span class="step-text">{{ cfg.markText }}</span>
      </div>
      <span class="step-state">{{ markStateText }}</span>
    </div>

    <div class="row gap8 chain-actions">
      <button type="button" class="btn btn-outline btn-sm" :disabled="phase !== 'idle'" @click="reserveStart">
        <Icon name="clock" :size="14" /> 预约开始（{{ cfg.reserveMin }} 分钟）
      </button>
      <button type="button" class="btn btn-primary btn-sm" :disabled="phase !== 'ready'" @click="startFocus">
        <Icon name="play" :size="14" /> 立即专注
      </button>
      <button v-if="phase !== 'idle'" type="button" class="btn btn-ghost btn-sm" @click="resetChain('已手动重置专注链')">
        重置
      </button>
    </div>
    <p class="muted mini chain-tip">{{ tip }}</p>

    <BaseModal :open="settingsOpen" title="专注链设置" @close="settingsOpen = false">
      <div class="cf">
        <div class="field">
          <span class="field-label">触发信号（进入专注前的启动动作）</span>
          <input v-model="form.triggerText" class="input" placeholder="如：深呼吸三次，把手机放到一边" />
        </div>
        <div class="field">
          <span class="field-label">专注标志（确认已进入状态的标志动作）</span>
          <input v-model="form.markText" class="input" placeholder="如：打开文件，写下今天最重要的一件事" />
        </div>
        <div class="field">
          <span class="field-label">预约倒计时（分钟）</span>
          <input v-model="form.reserveMin" class="input narrow" type="number" min="1" max="120" />
        </div>
        <p class="muted mini">倒计时结束前必须完成触发信号并勾选，否则本轮专注链重置。</p>
        <div class="row gap8" style="justify-content: flex-end">
          <button type="button" class="btn btn-outline btn-sm" @click="settingsOpen = false">取消</button>
          <button type="button" class="btn btn-primary btn-sm" @click="saveSettings">保存</button>
        </div>
      </div>
    </BaseModal>
  </section>
</template>

<script setup>
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import Icon from '../ui/Icon.vue'
import { store } from '../../store.js'
import { showToast } from '../../ui.js'
import { playChime, unlockAudio } from '../../sound.js'

const emit = defineEmits(['start'])

const cfg = computed(() => store.state.settings.focusChain || { triggerText: '', markText: '', reserveMin: 10 })

// 链式状态机：idle → reserved（预约倒计时）→ awaitMark（倒计时结束且信号完成）→ ready（标志完成）→ 开始专注
const phase = ref('idle')
const triggerDone = ref(false)
const markDone = ref(false)
const remainSec = ref(0)
let timer = null
const notice = ref('')

const clock = computed(() => {
  const s = Math.max(0, remainSec.value)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})

const tip = computed(() => {
  if (notice.value) return notice.value
  if (phase.value === 'idle') return '先点「预约开始」，在倒计时结束前完成触发信号并勾选。'
  if (phase.value === 'reserved') return triggerDone.value ? '触发信号已完成，等待倒计时结束解锁专注标志。' : '倒计时进行中：完成触发信号后点击卡片勾选。'
  if (phase.value === 'awaitMark') return '专注标志已解锁：完成对应动作后点击卡片勾选。'
  return '两项都已完成，可以点「立即专注」开始计时。'
})

const triggerStateText = computed(() => {
  if (triggerDone.value) return '✓ 已完成'
  if (phase.value === 'idle') return '待预约'
  if (phase.value === 'reserved') return '点击勾选'
  return '已完成'
})

const markStateText = computed(() => {
  if (markDone.value) return '✓ 已完成'
  if (phase.value === 'awaitMark') return '点击勾选'
  if (phase.value === 'ready') return '已完成'
  return '未解锁'
})

function stepClass(kind) {
  const isTrigger = kind === 'trigger'
  const done = isTrigger ? triggerDone.value : markDone.value
  const active = phase.value === (isTrigger ? 'reserved' : 'awaitMark')
  const locked = isTrigger ? phase.value === 'idle' : phase.value === 'idle' || phase.value === 'reserved'
  return { done, active, locked }
}

function tick() {
  remainSec.value -= 1
  if (remainSec.value > 0) return
  stopTimer()
  // 倒计时结束：已完成触发信号 → 解锁专注标志；否则本轮重置
  const soundOn = store.state.settings.soundOn !== false
  if (triggerDone.value) {
    phase.value = 'awaitMark'
    if (soundOn) playChime('chainUnlock')
    showToast('预约倒计时结束，专注标志已解锁')
  } else {
    if (soundOn) playChime('chainTimeout')
    resetChain('预约超时未完成触发信号，本轮专注链已重置')
  }
}

function startTimer() {
  stopTimer()
  timer = setInterval(tick, 1000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function reserveStart() {
  if (phase.value !== 'idle') return
  unlockAudio()
  triggerDone.value = false
  markDone.value = false
  notice.value = ''
  remainSec.value = Math.max(1, Number(cfg.value.reserveMin) || 10) * 60
  phase.value = 'reserved'
  startTimer()
}

function toggleTrigger() {
  if (phase.value !== 'reserved') return
  triggerDone.value = !triggerDone.value
}

function toggleMark() {
  if (phase.value !== 'awaitMark') return
  markDone.value = !markDone.value
  if (markDone.value) phase.value = 'ready'
  else phase.value = 'awaitMark'
}

function resetChain(message) {
  stopTimer()
  phase.value = 'idle'
  triggerDone.value = false
  markDone.value = false
  remainSec.value = 0
  notice.value = message || ''
}

function startFocus() {
  if (phase.value !== 'ready') return
  unlockAudio()
  emit('start')
  resetChain('专注已开始（链式流程已完成）')
}

// 任意阶段离开页面：进度全部清零
onBeforeUnmount(() => {
  stopTimer()
  phase.value = 'idle'
  triggerDone.value = false
  markDone.value = false
  remainSec.value = 0
})

// 设置
const settingsOpen = ref(false)
const form = reactive({ triggerText: '', markText: '', reserveMin: 10 })
function openSettings() {
  form.triggerText = cfg.value.triggerText || ''
  form.markText = cfg.value.markText || ''
  form.reserveMin = cfg.value.reserveMin || 10
  settingsOpen.value = true
}
function saveSettings() {
  store.setSetting('focusChain', {
    triggerText: form.triggerText.trim(),
    markText: form.markText.trim(),
    reserveMin: Math.max(1, Math.min(120, Number(form.reserveMin) || 10)),
  })
  settingsOpen.value = false
  showToast('专注链设置已保存')
}
</script>

<style scoped>
.chain-card {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chain-head {
  align-items: center;
}

.sec-title {
  margin: 0;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.countdown-chip {
  font-size: 12px;
  font-weight: 800;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-radius: 999px;
  padding: 2px 10px;
}

.mini-btn {
  font-size: 11.5px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.chain-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px dashed var(--line);
  background: var(--panel);
  transition: all 0.15s ease;
}

.chain-step.locked {
  opacity: 0.45;
  filter: grayscale(0.5);
}

.chain-step.active {
  border-style: solid;
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.chain-step.done {
  border-style: solid;
  border-color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
}

.step-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--line) 60%, transparent);
  color: var(--muted);
  flex: none;
}

.chain-step.active .step-icon {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  color: var(--accent-deep);
}

.chain-step.done .step-icon {
  background: color-mix(in srgb, var(--success) 22%, transparent);
  color: var(--success);
}

.step-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.step-label {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--muted);
}

.step-text {
  font-size: 13.5px;
  line-height: 1.4;
}

.chain-step.done .step-text {
  text-decoration: line-through;
  opacity: 0.75;
}

.step-state {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--muted);
  flex: none;
}

.chain-step.active .step-state {
  color: var(--accent-deep);
}

.chain-step.done .step-state {
  color: var(--success);
}

.chain-actions {
  align-items: center;
  flex-wrap: wrap;
}

.chain-tip {
  margin: 0;
}

.cf {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--muted);
}

.input {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
}

.input.narrow {
  width: 110px;
}
</style>
