<template>
  <div class="reviews-view">
    <div class="toolbar card">
      <div class="row-between wrap gap8">
        <SegControl :model-value="type" :options="typeOptions" @update:model-value="type = $event" />
        <button type="button" class="btn btn-primary" @click="openCreate">
          <Icon name="plus" :size="16" /> 写{{ PERIOD_TYPE_LABEL[type] }}
        </button>
      </div>
    </div>

    <template v-if="list.length">
      <ReviewCard
        v-for="r in list"
        :key="r.id"
        :review="r"
        @edit="openEdit"
        @remove="removeReview"
      />
    </template>
    <EmptyState v-else icon="book" text="还没有{{ PERIOD_TYPE_LABEL[type] }}" hint="定期回顾，把经验沉淀下来">
      <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="openCreate">
        <Icon name="plus" :size="16" /> 写第一篇{{ PERIOD_TYPE_LABEL[type] }}
      </button>
    </EmptyState>

    <BaseModal :open="form.open" :title="form.review ? '编辑' + PERIOD_TYPE_LABEL[form.review.type] : '写' + PERIOD_TYPE_LABEL[type]" @close="form.open = false">
      <ReviewFormModal
        v-if="form.open"
        :review="form.review"
        :default-type="type"
        @close="form.open = false"
        @saved="form.open = false"
      />
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store } from '../store.js'
import { reviewsFor } from '../selectors.js'
import { PERIOD_TYPES, PERIOD_TYPE_LABEL } from '../utils/date.js'
import { askConfirm, showToast } from '../ui.js'
import Icon from '../components/ui/Icon.vue'
import SegControl from '../components/ui/SegControl.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import ReviewCard from '../components/review/ReviewCard.vue'
import ReviewFormModal from '../components/review/ReviewFormModal.vue'

const type = ref('day')
const form = ref({ open: false, review: null })

const typeOptions = PERIOD_TYPES.map((t) => ({ label: PERIOD_TYPE_LABEL[t], value: t }))

const list = computed(() => reviewsFor(store.state, type.value))

function openCreate() {
  form.value = { open: true, review: null }
}

function openEdit(review) {
  form.value = { open: true, review }
}

async function removeReview(review) {
  const ok = await askConfirm({
    title: '删除复盘',
    message: `确定删除这条${PERIOD_TYPE_LABEL[review.type]}吗？内容将无法恢复。`,
    danger: true,
    okText: '删除',
  })
  if (!ok) return
  store.deleteReview(review.id)
  showToast('已删除')
}
</script>

<style scoped>
.reviews-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  padding: 12px;
}


.wrap {
  flex-wrap: wrap;
}
</style>
