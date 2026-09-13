<template>
  <div class="empty">
    <div class="empty-icon">
      <Icon :name="icon" :size="34" />
    </div>
    <p class="empty-text">{{ text }}</p>
    <p v-if="hint" class="empty-hint">{{ hint }}</p>
    <slot />
  </div>
</template>

<script setup>
import Icon from './Icon.vue'

defineProps({
  icon: { type: String, default: 'checkCircle' },
  text: { type: String, default: '这里还是空的' },
  hint: { type: String, default: '' },
})
</script>

<style scoped>
.empty {
  padding: 44px 20px;
  text-align: center;
  color: var(--text-dim);
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--primary) 45%, transparent);
  color: var(--primary-deep);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.empty-hint {
  margin: 6px 0 0;
  font-size: 13px;
}
</style>
