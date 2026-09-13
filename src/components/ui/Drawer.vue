<template>
  <Teleport to="body">
    <Transition name="fade-bg">
      <div v-if="open" class="drawer-mask" @click.self="$emit('close')">
        <Transition name="drawer" appear>
          <aside class="drawer-panel card" role="dialog" aria-modal="true">
            <div class="drawer-head">
              <h3 class="drawer-title">{{ title }}</h3>
              <button class="icon-btn" aria-label="关闭" @click="$emit('close')">
                <Icon name="x" :size="18" />
              </button>
            </div>
            <div class="drawer-body">
              <slot />
            </div>
          </aside>
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
.drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  z-index: 100;
}

.drawer-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: min(92vw, 430px);
  border-radius: 0;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 6px;
}

.drawer-title {
  margin: 0;
  font-size: 16px;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 16px 20px;
}

.icon-btn {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--text-dim);
}

.icon-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text);
}
</style>
