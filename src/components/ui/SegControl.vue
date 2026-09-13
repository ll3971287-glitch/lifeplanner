<template>
  <div class="seg" role="tablist">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="seg-item"
      :class="{ active: modelValue === opt.value }"
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, required: true },
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.seg {
  display: inline-flex;
  background: rgba(0, 0, 0, 0.045);
  border-radius: 11px;
  padding: 3px;
  gap: 2px;
  flex-wrap: wrap;
}

.seg-item {
  padding: 6px 13px;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-dim);
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
}

.seg-item.active {
  background: var(--card);
  color: var(--accent-deep);
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.1);
}
</style>
