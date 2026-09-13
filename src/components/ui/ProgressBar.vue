<template>
  <div class="progress" role="progressbar" :aria-valuenow="value">
    <div class="progress-fill" :style="{ width: pct + '%' }" />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
})

const pct = computed(() => Math.max(0, Math.min(100, Math.round(props.value))))
</script>

<style scoped>
.progress {
  height: 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.07);
  overflow: hidden;
  flex: 1;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--primary-deep), var(--accent));
  transition: width 0.3s ease;
}
</style>
