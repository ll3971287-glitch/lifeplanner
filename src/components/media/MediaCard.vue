<template>
  <button type="button" class="media-card card" @click="$emit('open', item.id)">
    <div class="cover" :style="coverStyle">
      <img v-if="item.coverUrl" :src="item.coverUrl" alt="" @error="imgOk = false" v-show="imgOk" />
      <span v-if="!item.coverUrl || !imgOk" class="cover-letter">{{ item.title.slice(0, 1) }}</span>
      <span class="state-dot" :class="statusMeta(item.status).cls">{{ statusLabel(item.status) }}</span>
      <span v-if="item.favorite" class="fav-star" :title="wishLabel(item.category)">★</span>
    </div>

    <div class="body">
      <h3 class="m-title" :title="item.title">{{ item.title }}</h3>
      <p v-if="item.creator" class="m-creator muted">{{ item.creator }}</p>

      <div class="row gap6 rate-line">
        <span class="stars">{{ stars }}</span>
        <span class="cat-tag" :style="{ background: catColor(item.category) }">{{ catLabel(item.category) }}</span>
      </div>

      <div v-if="prog.pct != null" class="prog">
        <ProgressBar :value="prog.pct" />
      </div>
      <p v-if="prog.text" class="muted prog-text">{{ prog.text }}</p>

      <div v-if="item.tags && item.tags.length" class="row gap4 wrap tag-line">
        <span v-for="t in item.tags.slice(0, 3)" :key="t" class="mini-tag">{{ t }}</span>
        <span v-if="item.tags.length > 3" class="muted mini">+{{ item.tags.length - 3 }}</span>
      </div>

      <p v-if="item.oneLine" class="one-line">{{ item.oneLine }}</p>
      <p v-if="dateText" class="muted mini date-line">{{ dateText }}</p>
    </div>
  </button>
</template>

<script setup>
import { ref, computed } from 'vue'
import ProgressBar from '../ui/ProgressBar.vue'
import { catColor, catLabel, statusLabel, statusMeta, progressInfo, ratingStars, wishLabel } from '../../mediaMeta.js'
import { fmtDate } from '../../utils/date.js'

const props = defineProps({ item: { type: Object, required: true } })
defineEmits(['open'])

const imgOk = ref(true)
const stars = computed(() => ratingStars(props.item.rating))
const prog = computed(() => progressInfo(props.item))
const coverStyle = computed(() => {
  const used = new Set([props.item.coverUrl].filter(Boolean))
  return used.size && !imgOk.value ? { background: catColor(props.item.category) } : {}
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
.media-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  text-align: left;
  padding: 0;
  cursor: pointer;
}

.cover {
  position: relative;
  aspect-ratio: 3 / 4;
  background: color-mix(in srgb, var(--line) 60%, transparent);
  display: grid;
  place-items: center;
  overflow: hidden;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-letter {
  font-size: 34px;
  font-weight: 800;
  color: var(--text-dim);
}

.state-dot {
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 10.5px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
  backdrop-filter: blur(4px);
}

.state-dot.todo {
  background: color-mix(in srgb, var(--line) 85%, transparent);
  color: var(--text-dim);
}

.state-dot.doing {
  background: color-mix(in srgb, var(--accent) 85%, transparent);
  color: var(--accent-deep);
}

.state-dot.done {
  background: color-mix(in srgb, var(--success) 85%, transparent);
  color: #fff;
}

.state-dot.paused {
  background: color-mix(in srgb, var(--warn) 80%, transparent);
  color: #fff;
}

.fav-star {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 15px;
  color: var(--warn);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}

.body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

.m-title {
  margin: 0;
  font-size: 14.5px;
  font-weight: 800;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.m-creator {
  margin: 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rate-line {
  align-items: center;
}

.stars {
  font-size: 12.5px;
  color: var(--warn);
  letter-spacing: 1px;
}

.cat-tag {
  font-size: 10.5px;
  font-weight: 700;
  color: #fff;
  border-radius: 999px;
  padding: 1px 7px;
}

.prog {
  margin-top: 2px;
}

.prog-text {
  margin: 0;
  font-size: 11.5px;
}

.tag-line {
  margin-top: 1px;
}

.mini-tag {
  font-size: 10.5px;
  padding: 1px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent-deep);
}

.one-line {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-dim);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.date-line {
  margin: 0;
}
</style>
