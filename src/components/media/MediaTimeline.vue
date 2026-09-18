<template>
  <div class="timeline card">
    <p class="muted mini tl-hint">按时间倒序展示全部品类的记录（共 {{ items.length }} 条）</p>
    <div v-for="g in groups" :key="g.key" class="tl-group">
      <h4 class="tl-month">{{ g.label }}</h4>
      <button v-for="m in g.items" :key="m.id" type="button" class="tl-row" @click="$emit('open', m.id)">
        <span class="tl-cover" :style="{ background: catColor(m.category) }">
          <img v-if="m.coverUrl" :src="m.coverUrl" alt="" />
          <span v-else>{{ m.title.slice(0, 1) }}</span>
        </span>
        <span class="tl-main">
          <span class="row gap6 tl-line">
            <span class="tl-title">{{ m.title }}</span>
            <span class="cat-chip" :style="{ background: catColor(m.category) }">{{ catLabel(m.category) }}</span>
            <span class="st-chip" :class="statusMeta(m.status).cls">{{ statusLabel(m.status) }}</span>
          </span>
          <span class="muted mini tl-sub">
            {{ [m.creator, fmtDate(mediaTimelineTs(m))].filter(Boolean).join(' · ') }}
          </span>
          <span v-if="m.oneLine" class="tl-note">{{ m.oneLine }}</span>
        </span>
        <span class="tl-side">
          <span class="stars">{{ ratingStars(m.rating) }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { catColor, catLabel, statusLabel, statusMeta, ratingStars } from '../../mediaMeta.js'
import { mediaTimelineTs } from '../../selectors.js'
import { fmtDate } from '../../utils/date.js'

const props = defineProps({ items: { type: Array, default: () => [] } })
defineEmits(['open'])

// 按月份分组（倒序）
const groups = computed(() => {
  const out = []
  const map = new Map()
  for (const m of props.items) {
    const ts = mediaTimelineTs(m)
    if (!ts) continue
    const d = new Date(ts)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    if (!map.has(key)) {
      const g = { key, label: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`, items: [] }
      map.set(key, g)
      out.push(g)
    }
    map.get(key).items.push(m)
  }
  return out
})
</script>

<style scoped>
.timeline {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tl-hint {
  margin: 0;
}

.tl-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tl-month {
  margin: 8px 0 2px;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--muted);
}

.tl-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 8px 4px;
  border-bottom: 1px dashed var(--line);
}

.tl-cover {
  width: 34px;
  height: 46px;
  border-radius: 7px;
  overflow: hidden;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 800;
  font-size: 15px;
  flex: none;
}

.tl-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tl-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tl-line {
  align-items: center;
}

.tl-title {
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

.st-chip {
  font-size: 10px;
  font-weight: 700;
  border-radius: 999px;
  padding: 1px 7px;
  flex: none;
}

.st-chip.todo {
  background: var(--line);
  color: var(--text-dim);
}

.st-chip.doing {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent-deep);
}

.st-chip.done {
  background: color-mix(in srgb, var(--success) 16%, transparent);
  color: var(--success);
}

.st-chip.paused {
  background: color-mix(in srgb, var(--warn) 16%, transparent);
  color: var(--warn);
}

.tl-sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tl-note {
  font-size: 12px;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tl-side {
  flex: none;
}

.stars {
  font-size: 12.5px;
  color: var(--warn);
  letter-spacing: 1px;
}
</style>
