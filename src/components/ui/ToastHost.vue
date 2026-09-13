<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="toastState.visible" class="toast" :class="toastState.kind">
        <Icon :name="toastState.kind === 'err' ? 'alert' : 'check' " :size="15" />
        <span>{{ toastState.message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { toastState } from '../../ui.js'
import Icon from './Icon.vue'
</script>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(var(--navbar-h) + 24px);
  transform: translateX(-50%);
  background: var(--text);
  color: #fff;
  padding: 9px 16px;
  border-radius: 999px;
  font-size: 13.5px;
  z-index: 300;
  display: flex;
  align-items: center;
  gap: 7px;
  box-shadow: var(--shadow-lg);
  max-width: 86vw;
}

.toast.err {
  background: var(--danger);
}
</style>
