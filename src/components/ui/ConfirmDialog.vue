<template>
  <Teleport to="body">
    <Transition name="fade-bg">
      <div v-if="confirmState.visible" class="confirm-mask">
        <div class="confirm-panel card">
          <h3 class="confirm-title">{{ confirmState.title }}</h3>
          <p class="confirm-msg">{{ confirmState.message }}</p>
          <p v-if="confirmState.detail" class="confirm-detail">{{ confirmState.detail }}</p>
          <div class="confirm-actions">
            <button class="btn btn-ghost" @click="settleConfirm(false)">取消</button>
            <button class="btn" :class="confirmState.danger ? 'btn-danger' : 'btn-primary'" @click="settleConfirm(true)">
              {{ confirmState.okText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { confirmState, settleConfirm } from '../../ui.js'
</script>

<style scoped>
.confirm-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.confirm-panel {
  width: min(92vw, 380px);
  padding: 20px 18px 16px;
  border-radius: 16px;
}

.confirm-title {
  margin: 0 0 6px;
  font-size: 16px;
}

.confirm-msg {
  margin: 0;
  color: var(--text);
  white-space: pre-wrap;
}

.confirm-detail {
  margin: 6px 0 0;
  color: var(--text-dim);
  font-size: 13px;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
</style>
