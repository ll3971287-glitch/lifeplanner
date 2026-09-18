<template>
  <div class="goals-view">
    <GoalsPanel standalone />
  </div>
</template>

<script setup>
import GoalsPanel from '../components/goal/GoalsPanel.vue'
</script>

<style scoped>
.goals-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
