<template>
  <button
    type="button"
    class="icon-btn"
    :title="title"
    :aria-label="title || name"
    :class="[tone, { round }]"
    @click="$emit('click')"
  >
    <Icon :name="name" :size="size" />
  </button>
</template>

<script setup>
import Icon from './Icon.vue'

defineProps({
  name: { type: String, required: true },
  title: { type: String, default: '' },
  size: { type: Number, default: 18 },
  tone: { type: String, default: 'ghost' },
  round: { type: Boolean, default: false },
})

defineEmits(['click'])
</script>

<style scoped>
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  flex: none;
  color: var(--text-dim);
}

.icon-btn.round {
  border-radius: 50%;
}

.icon-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text);
}

.icon-btn.primary {
  background: var(--primary);
  color: var(--primary-deep);
}

.icon-btn.danger {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}
</style>
