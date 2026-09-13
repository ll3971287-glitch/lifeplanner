<template>
  <span v-for="tg in tags" :key="tg.id" class="tag-chip" :style="{ background: tg.color }">
    {{ tg.name }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { store } from '../../store.js'
import { tagsOf } from '../../selectors.js'

const props = defineProps({
  tagIds: { type: Array, default: () => [] },
})

const tags = computed(() => tagsOf(store.state, props.tagIds))
</script>
