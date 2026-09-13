<template>
  <Teleport to="body">
    <Transition name="fade-bg">
      <div v-if="open" class="modal-mask" @click.self="$emit('close')">
        <Transition name="slide-up" appear>
          <div class="modal-panel card" role="dialog" aria-modal="true">
            <div v-if="title || $slots.head" class="modal-head">
              <h3 class="modal-title">{{ title }}</h3>
              <button class="icon-btn" aria-label="关闭" @click="$emit('close')">
                <Icon name="x" :size="18" />
              </button>
            </div>
            <div class="modal-body">
              <slot />
            </div>
            <div v-if="$slots.foot" class="modal-foot">
              <slot name="foot" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import Icon from './Icon.vue'

defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
})

defineEmits(['close'])
</script>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 12px;
}

.modal-panel {
  width: 100%;
  max-width: 520px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  border-radius: 18px;
  overflow: hidden;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 4px;
}

.modal-title {
  margin: 0;
  font-size: 16px;
}

.modal-body {
  padding: 10px 16px 16px;
  overflow-y: auto;
}

.modal-foot {
  padding: 8px 16px 16px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

@media (min-width: 640px) {
  .modal-mask {
    align-items: center;
  }
}

.icon-btn {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--text-dim);
  flex: none;
}

.icon-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text);
}
</style>
