<template>
  <button type="button" class="media-row card" @click="$emit('open', item.id)">
    <span class="cover" :style="coverStyle">
      <img v-if="item.coverUrl && imgOk" :src="item.coverUrl" alt="" @error="imgOk = false" />
      <span v-else class="cover-letter">{{ (item.title || '?').slice(0, 1) }}</span>
    </span>

    <span class="row-main">
      <span class="row-top">
        <span class="m-title" :title="item.title">{{ item.title }}</span>
        <span class="cat-chip" :style="{ background: catColor(item.category) }">{{ catLabel(item.category) }}</span>
        <span class="state-chip" :class="statusMeta(item.status).cls">{{ statusLabel(item.status) }}</span>
        <span v-if="item.favorite" class="fav" :title="wishLabel(item.category)">★</span>
      </span>

      <span class="row-sub muted">
        <span v-if="item.creator" class="sub-item">{{ item.creator }}</span>
        <span v-if="stars" class="sub-item stars">{{ stars }}</span>
        <span v-if="prog.text" class="sub-item">{{ prog.text }}</span>
        <span v-if="dateText" class="sub-item">{{ dateText }}</span>
      </span>

      <!-- 个人专属标签（每条记录自己的标签） -->
      <span v-if="item.tags && item.tags.length" class="tag-line">
        <span v-for="t in item.tags" :key="t" class="mini-tag">{{ t }}</span>
      </span>

      <span v-if="item.oneLine" class="one-line muted">{{ item.oneLine }}</span>
      <span v-if="prog.pct != null" class="prog"><ProgressBar :value="prog.pct" /></span>
    </span>

    <Icon name="chevronRight" :size="15" class="go" />
  </button>
</template>

<script setup>
import { ref, computed } from 'vue'
import ProgressBar from '../ui/ProgressBar.vue'
import Icon from '../ui/Icon.vue'
import { catColor, catLabel, statusLabel, statusMeta, progressInfo, ratingStars, wishLabel } from '../../mediaMeta.js'
import { fmtDate } from '../../utils/date.js'

const props = defineProps({ item: { type: Object, required: true } })
defineEmits(['open'])

const imgOk = ref(true)
const stars = computed(() => ratingStars(props.item.rating))
const prog = computed(() => progressInfo(props.item))
const coverStyle = computed(() => {
  if (props.item.coverUrl && imgOk.value) return {}
  return { background: catColor(props.item.category) }
})
const dateText = computed(() => {
  const s = props.item.startDate
  const e = props.item.endDate
  if (!s && !e) return ''
  if (s && e) return `${fmtDate(s)} ~ ${fmtDate(e)}`
  if (s) return `${fmtDate(s)} 开始`
  return `${fmtDate(e)} 完结`
})
</script>

<style scoped>
.media-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
}

.media-row:active {
  transform: scale(0.995);
}

.cover {
  width: 42px;
  height: 56px;
  border-radius: 9px;
  overflow: hidden;
  display: grid;
  place-items: center;
  flex: none;
  color: #fff;
  font-weight: 800;
  font-size: 18px;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-letter {
  opacity: 0.92;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.row-top {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.m-title {
  font-size: 14.5px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.cat-chip {
  font-size: 10.5px;
  font-weight: 700;
  color: #fff;
  border-radius: 999px;
  padding: 1px 8px;
  flex: none;
}

.state-chip {
  font-size: 10.5px;
  font-weight: 700;
  border-radius: 999px;
  padding: 1px 8px;
  flex: none;
  color: var(--muted);
  background: color-mix(in srgb, var(--line) 60%, transparent);
}

.state-chip.doing {
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.state-chip.done {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 14%, transparent);
}

.state-chip.paused {
  color: var(--warn);
  background: color-mix(in srgb, var(--warn) 14%, transparent);
}

.fav {
  color: #f59e0b;
  font-size: 12px;
  flex: none;
}

.row-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11.5px;
}

.sub-item {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stars {
  color: var(--warn);
  letter-spacing: 0.5px;
}

/* 个人专属标签 */
.tag-line {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.mini-tag {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-radius: 999px;
  padding: 1px 8px;
}

.one-line {
  font-size: 11.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prog {
  display: flex;
  align-items: center;
  min-width: 0;
  margin-top: 1px;
}

.prog :deep(.progress) {
  height: 6px;
}

.go {
  color: var(--text-dim);
  flex: none;
}
</style>
