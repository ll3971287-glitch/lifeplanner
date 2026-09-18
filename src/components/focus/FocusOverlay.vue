<template>
  <Teleport to="body">
    <Transition name="fade-bg">
      <div v-if="store.focusState.visible" class="focus-overlay">
        <div class="overlay-top">
          <button type="button" class="pill-btn" @click="goFocusPage">
            <Icon name="external" :size="15" /> 专注页
          </button>
          <button type="button" class="pill-btn" @click="store.closeFocus()">
            <Icon name="chevronDown" :size="15" /> 收起
          </button>
        </div>
        <div class="overlay-body">
          <FocusTimer />
        </div>
        <p class="hint muted">收起后计时继续，随时可从首页返回</p>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../../store.js'
import { playChime, unlockAudio } from '../../sound.js'
import FocusTimer from './FocusTimer.vue'
import Icon from '../ui/Icon.vue'

const router = useRouter()

// 专注到点 → 上行铃声；休息结束 → 柔和提示音（与设置里的开关联动）
watch(
  () => store.focusState.phase,
  (now, before) => {
    if (store.state.settings.soundOn === false) return
    if (before === 'run' && now === 'break') playChime('focusEnd')
    else if (before === 'break' && now === 'idle') playChime('breakEnd')
  }
)

onMounted(unlockAudio)

function goFocusPage() {
  store.closeFocus()
  router.push('/focus')
}
</script>

<style scoped>
.focus-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.overlay-top {
  width: 100%;
  max-width: var(--maxw);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
}

.pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 15px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-dim);
  font-size: 13.5px;
  font-weight: 600;
}

.overlay-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 10px 20px 40px;
}

.hint {
  padding-bottom: 18px;
  font-size: 12.5px;
}
</style>
