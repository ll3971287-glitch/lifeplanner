<template>
  <div class="tags-view">
    <div class="toolbar card">
      <div class="row-between gap8 wrap">
        <div>
          <h2 class="page-title">标签</h2>
          <p class="muted title-sub">给任务和项目分类，点开看全部关联</p>
        </div>
        <button type="button" class="btn btn-primary" @click="openCreate">
          <Icon name="plus" :size="16" /> 新建标签
        </button>
      </div>
    </div>

    <div v-if="store.state.tags.length" class="tag-grid">
      <button
        v-for="tg in store.state.tags"
        :key="tg.id"
        type="button"
        class="tag-card card"
        @click="router.push(`/tags/${tg.id}`)"
      >
        <span class="tag-dot" :style="{ background: tg.color }" />
        <span class="tag-name">{{ tg.name }}</span>
        <span class="tag-count muted">{{ totalOf(tg.id) }} 项关联</span>
      </button>
    </div>
    <EmptyState v-else icon="tag" text="还没有标签" hint="标签可以把不同模块的内容串起来">
      <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="openCreate">
        <Icon name="plus" :size="16" /> 创建第一个标签
      </button>
    </EmptyState>

    <BaseModal :open="form.open" title="新建标签" @close="form.open = false">
      <TagFormModal v-if="form.open" @close="form.open = false" @saved="form.open = false" />
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../store.js'
import { tagCounts } from '../selectors.js'
import Icon from '../components/ui/Icon.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import TagFormModal from '../components/tag/TagFormModal.vue'

const router = useRouter()

const form = ref({ open: false })

const counts = computed(() => tagCounts(store.state))

function totalOf(id) {
  const c = counts.value[id]
  return c ? c.todo + c.project + c.sub : 0
}

function openCreate() {
  form.value = { open: true }
}
</script>

<style scoped>
.tags-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  padding: 14px;
}

.page-title {
  margin: 0;
  font-size: 18px;
}

.title-sub {
  margin: 2px 0 0;
}

.tag-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 11px;
}

.tag-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 16px 14px;
  cursor: pointer;
  text-align: left;
  transition: transform 0.1s ease;
}

.tag-card:active {
  transform: scale(0.97);
}

.tag-dot {
  width: 34px;
  height: 34px;
  border-radius: 10px;
}

.tag-name {
  font-size: 16px;
  font-weight: 700;
}

.tag-count {
  font-size: 12.5px;
}
</style>
