<template>
  <div class="media-view">
    <div class="toolbar card">
      <SegControl :model-value="category" :options="catOptions" @update:model-value="category = $event" />
      <div class="row-between gap8 wrap filter-row">
        <SegControl :model-value="statusFilter" :options="statusOptions" @update:model-value="statusFilter = $event" />
        <button type="button" class="btn btn-primary btn-sm" @click="openCreate">
          <Icon name="plus" :size="15" /> 添加{{ catLabel(category) }}
        </button>
      </div>
      <p class="muted mini count-line">
        共 {{ stats.total }} 条 · 已完成 {{ stats.done }} · 完成率 {{ stats.rate }}%
      </p>
    </div>

    <!-- 收藏清单 -->
    <div v-if="wishes.length" class="card wish-card">
      <button type="button" class="row-between wish-head" @click="wishOpen = !wishOpen">
        <span class="row gap6 wish-title">
          <Icon name="check" :size="14" /> {{ wishLabel(category) }}清单（{{ wishes.length }}）
        </span>
        <Icon :name="wishOpen ? 'chevronDown' : 'chevronRight'" :size="15" />
      </button>
      <div v-if="wishOpen" class="wish-list">
        <div v-for="m in wishes" :key="m.id" class="wish-row">
          <span class="wish-name">{{ m.title }}</span>
          <span v-if="m.creator" class="muted mini">{{ m.creator }}</span>
          <button type="button" class="btn btn-outline btn-sm" @click="store.setMediaStatus(m.id, 'doing')">一键开始</button>
        </div>
      </div>
    </div>

    <div v-if="list.length" class="grid">
      <MediaCard v-for="m in list" :key="m.id" :item="m" @open="openDrawer" />
    </div>
    <EmptyState v-else icon="book" :text="emptyText" hint="把读过的书、看过的影视、玩过的游戏记录下来">
      <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="openCreate">
        <Icon name="plus" :size="15" /> 添加第一条{{ catLabel(category) }}记录
      </button>
    </EmptyState>

    <MediaFormModal :open="form.open" :item="form.item" :default-category="category" @close="form.open = false" />
    <MediaDrawer :open="drawer.open" :item-id="drawer.id" @close="drawer.open = false" @edit="openEdit" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store } from '../store.js'
import { mediaOf, mediaCategoryStats, mediaFavorites } from '../selectors.js'
import { MEDIA_CATS, MEDIA_STATUS_ORDER, catLabel, statusLabel, wishLabel } from '../mediaMeta.js'
import SegControl from '../components/ui/SegControl.vue'
import Icon from '../components/ui/Icon.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import MediaCard from '../components/media/MediaCard.vue'
import MediaDrawer from '../components/media/MediaDrawer.vue'
import MediaFormModal from '../components/media/MediaFormModal.vue'

const category = ref('book')
const statusFilter = ref('all')
const wishOpen = ref(true)

const catOptions = MEDIA_CATS.map((c) => ({ label: c.label, value: c.key }))
const statusOptions = [{ label: '全部', value: 'all' }, ...MEDIA_STATUS_ORDER.map((k) => ({ label: statusLabel(k), value: k }))]

const allOfCat = computed(() => mediaOf(store.state, category.value))
const list = computed(() => (statusFilter.value === 'all' ? allOfCat.value : allOfCat.value.filter((m) => m.status === statusFilter.value)))
const stats = computed(() => mediaCategoryStats(store.state, category.value))
const wishes = computed(() => mediaFavorites(store.state, category.value))

const emptyText = computed(() => {
  if (!allOfCat.value.length) return `还没有${catLabel(category.value)}记录`
  return `没有符合筛选的${catLabel(category.value)}记录`
})

const form = ref({ open: false, item: null })
const drawer = ref({ open: false, id: null })

function openCreate() {
  form.value = { open: true, item: null }
}
function openEdit(item) {
  drawer.value.open = false
  form.value = { open: true, item }
}
function openDrawer(id) {
  drawer.value = { open: true, id }
}
</script>

<style scoped>
.media-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filter-row {
  align-items: center;
}

.count-line {
  margin: 0;
}

.wish-card {
  padding: 12px 14px;
}

.wish-head {
  width: 100%;
  align-items: center;
}

.wish-title {
  font-size: 14px;
  font-weight: 800;
  align-items: center;
}

.wish-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wish-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 2px;
  border-bottom: 1px dashed var(--line);
}

.wish-name {
  font-size: 13.5px;
  font-weight: 600;
}

.wish-row .btn {
  margin-left: auto;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
</style>
