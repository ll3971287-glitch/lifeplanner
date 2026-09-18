<template>
  <div class="media-view">
    <!-- 数据总览 -->
    <div class="card ov-card">
      <div class="row-between ov-head">
        <h3 class="ov-title"><Icon name="film" :size="15" /> 书影音总览</h3>
        <span class="muted mini">共 {{ overview.total }} 条 · 完成 {{ overview.done }} · 完成率 {{ overview.rate }}%</span>
      </div>
      <div class="ov-grid">
        <div v-for="c in overview.byCat" :key="c.key" class="ov-cell">
          <span class="ov-name">{{ catLabel(c.key) }}</span>
          <span class="ov-num">{{ c.total }}</span>
          <span class="muted mini">完成率 {{ c.rate }}%</span>
        </div>
      </div>
    </div>

    <!-- 年度 TOP 排行 -->
    <div v-if="topList.length" class="card top-card">
      <div class="row-between top-head">
        <h3 class="top-title"><Icon name="flag" :size="14" /> {{ topTitle }}</h3>
        <span class="muted mini">按评分 · 同分按完结时间</span>
      </div>
      <div class="top-list">
        <button v-for="(m, i) in topList" :key="m.id" type="button" class="top-row" @click="openDrawer(m.id)">
          <span class="top-rank" :class="'rk' + (i + 1)">{{ i + 1 }}</span>
          <span class="top-name">{{ m.title }}</span>
          <span class="cat-chip" :style="{ background: catColor(m.category) }">{{ catLabel(m.category) }}</span>
          <span class="stars">{{ ratingStars(m.rating) }}</span>
        </button>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar card">
      <div class="row-between gap8 wrap">
        <SegControl :model-value="view" :options="viewOptions" @update:model-value="view = $event" />
        <button v-if="view === 'cards'" type="button" class="btn btn-primary btn-sm" @click="openCreate">
          <Icon name="plus" :size="15" /> 添加{{ catLabel(category) }}
        </button>
      </div>

      <template v-if="view === 'cards'">
        <SegControl :model-value="category" :options="catOptions" @update:model-value="category = $event" />
        <div class="row-between gap8 wrap filter-row">
          <SegControl :model-value="statusFilter" :options="statusOptions" @update:model-value="statusFilter = $event" />
        </div>
        <p class="muted mini count-line">
          共 {{ stats.total }} 条 · 已完成 {{ stats.done }} · 完成率 {{ stats.rate }}%
        </p>
      </template>
    </div>

    <!-- 卡片视图 -->
    <template v-if="view === 'cards'">
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
    </template>

    <!-- 时间线视图 -->
    <template v-else>
      <MediaTimeline v-if="timeline.length" :items="timeline" @open="openDrawer" />
      <EmptyState v-else icon="clock" text="还没有任何记录" hint="添加书籍、影视或游戏后，这里会按时间倒序展示" />
    </template>

    <MediaFormModal :open="form.open" :item="form.item" :default-category="category" @close="form.open = false" />
    <MediaDrawer :open="drawer.open" :item-id="drawer.id" @close="drawer.open = false" @edit="openEdit" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store } from '../store.js'
import { mediaOf, mediaCategoryStats, mediaFavorites, mediaOverview, mediaTopRated, mediaTimeline } from '../selectors.js'
import { MEDIA_CATS, MEDIA_STATUS_ORDER, catLabel, catColor, statusLabel, ratingStars, wishLabel } from '../mediaMeta.js'
import SegControl from '../components/ui/SegControl.vue'
import Icon from '../components/ui/Icon.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import MediaCard from '../components/media/MediaCard.vue'
import MediaDrawer from '../components/media/MediaDrawer.vue'
import MediaFormModal from '../components/media/MediaFormModal.vue'
import MediaTimeline from '../components/media/MediaTimeline.vue'

const category = ref('book')
const statusFilter = ref('all')
const wishOpen = ref(true)
const view = ref('cards')

const viewOptions = [
  { label: '卡片', value: 'cards' },
  { label: '时间线', value: 'timeline' },
]
const catOptions = MEDIA_CATS.map((c) => ({ label: c.label, value: c.key }))
const statusOptions = [{ label: '全部', value: 'all' }, ...MEDIA_STATUS_ORDER.map((k) => ({ label: statusLabel(k), value: k }))]

const overview = computed(() => mediaOverview(store.state))
const thisYear = new Date().getFullYear()
// 年度 TOP：当年没有已完成评分记录时，回退展示「全部时间」
const topInfo = computed(() => {
  const y = mediaTopRated(store.state, thisYear)
  if (y.length) return { list: y, title: `${thisYear} 年 TOP ${y.length}` }
  const all = mediaTopRated(store.state, null)
  return { list: all, title: all.length ? `全部时间 TOP ${all.length}` : '' }
})
const topList = computed(() => topInfo.value.list)
const topTitle = computed(() => topInfo.value.title)

const allOfCat = computed(() => mediaOf(store.state, category.value))
const list = computed(() => (statusFilter.value === 'all' ? allOfCat.value : allOfCat.value.filter((m) => m.status === statusFilter.value)))
const stats = computed(() => mediaCategoryStats(store.state, category.value))
const wishes = computed(() => mediaFavorites(store.state, category.value))
const timeline = computed(() => mediaTimeline(store.state))

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

.ov-card {
  padding: 12px 14px;
}

.ov-head {
  align-items: center;
  margin-bottom: 8px;
}

.ov-title,
.top-title {
  margin: 0;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ov-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 6px;
}

.ov-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 8px 4px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--line) 35%, transparent);
}

.ov-name {
  font-size: 11.5px;
  color: var(--muted);
}

.ov-num {
  font-size: 18px;
  font-weight: 800;
}

.top-card {
  padding: 12px 14px;
}

.top-head {
  align-items: center;
  margin-bottom: 6px;
}

.top-list {
  display: flex;
  flex-direction: column;
}

.top-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 7px 2px;
  border-bottom: 1px dashed var(--line);
}

.top-rank {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  background: color-mix(in srgb, var(--line) 70%, transparent);
  color: var(--text-dim);
  flex: none;
}

.top-rank.rk1 {
  background: color-mix(in srgb, var(--warn) 30%, transparent);
  color: var(--warn);
}

.top-rank.rk2,
.top-rank.rk3 {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  color: var(--accent-deep);
}

.top-name {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-chip {
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  border-radius: 999px;
  padding: 1px 7px;
  flex: none;
}

.stars {
  font-size: 12.5px;
  color: var(--warn);
  letter-spacing: 1px;
  flex: none;
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
