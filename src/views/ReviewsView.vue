<template>
  <div class="reviews-view">
    <!-- 目标板块入口（点击才进入） -->
    <button v-if="panel === 'list'" type="button" class="goal-entry card" @click="panel = 'goals'">
      <span class="ge-icon"><Icon name="flag" :size="17" /></span>
      <span class="ge-main">
        <span class="ge-title">目标</span>
        <span class="ge-sub muted">按月度 / 季度规划目标清单，含日历与自由记录；供下方复盘引用</span>
      </span>
      <span class="ge-count muted">{{ goalTotal }} 个目标</span>
      <Icon name="chevronRight" :size="16" />
    </button>

    <GoalsPanel v-if="panel === 'goals'" @back="panel = 'list'" />

    <template v-if="panel === 'list'">
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
    </template>
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
import GoalsPanel from '../components/goal/GoalsPanel.vue'
import ReviewFormModal from '../components/review/ReviewFormModal.vue'

const type = ref('day')
const form = ref({ open: false, review: null })
const panel = ref('list')
const goalTotal = computed(() => store.state.goals.length)

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

.goal-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  text-align: left;
  width: 100%;
}

.ge-icon {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  flex: none;
}

.ge-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ge-title {
  font-size: 15px;
  font-weight: 800;
}

.ge-sub {
  font-size: 12px;
  line-height: 1.4;
}

.ge-count {
  font-size: 12px;
  flex: none;
}

.wrap {
  flex-wrap: wrap;
}
</style>
