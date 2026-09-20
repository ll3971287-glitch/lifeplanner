<template>
  <div class="food-row card" :class="'lv-' + level">
    <span class="level-bar" :style="{ background: levelColor }" />
    <div class="thumb" :style="{ background: item.imageUrl ? 'transparent' : placeColor(item.place) }">
      <img v-if="item.imageUrl" :src="item.imageUrl" alt="" />
      <span v-else>{{ item.name.slice(0, 1) }}</span>
    </div>

    <div class="main">
      <div class="row gap6 name-line">
        <span class="f-name">{{ item.name }}</span>
        <span class="level-chip" :class="level">{{ levelLabel(level) }}</span>
        <span v-if="item.status !== 'stored'" class="off-chip">{{ statusLabel(item.status) }}</span>
      </div>
      <div class="row gap6 wrap meta-line">
        <span class="meta">{{ item.category }}</span>
        <span class="meta place" :style="{ color: placeColor(item.place) }">{{ placeLabel(item.place) }}</span>
        <span class="meta">{{ item.opened ? '已开封' : '未开封' }}</span>
      </div>
      <div class="row gap6 wrap date-line">
        <span class="muted mini">入库 {{ fmtDate(item.storedAt) }}</span>
        <span class="muted mini">过期 {{ item.expireAt ? fmtDate(item.expireAt) : '未设置' }}</span>
        <span v-if="item.status === 'stored'" class="left-text" :class="level">{{ leftText(item) }}</span>
      </div>
      <div v-if="item.status === 'stored'" class="pct-line">
        <ProgressBar :value="item.percent" />
        <span class="pct-text">剩余 {{ item.percent }}%</span>
      </div>
      <p v-if="item.note" class="note muted">{{ item.note }}</p>
    </div>

    <div class="ops">
      <template v-if="item.status === 'stored'">
        <button type="button" class="op" title="消耗 25%" @click="$emit('minus25', item)">−25%</button>
        <button type="button" class="op" title="标记已消耗" @click="$emit('consume', item)">
          <Icon name="check" :size="14" />
        </button>
        <button type="button" class="op danger" title="标记丢弃" @click="$emit('discard', item)">
          <Icon name="trash" :size="14" />
        </button>
      </template>
      <button v-else type="button" class="op" title="恢复入库" @click="$emit('restore', item)">
        <Icon name="refresh" :size="14" />
      </button>
      <button type="button" class="op" title="编辑" @click="$emit('edit', item)">
        <Icon name="edit" :size="14" />
      </button>
      <button type="button" class="op danger" title="删除" @click="$emit('remove', item)">
        <Icon name="x" :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Icon from '../ui/Icon.vue'
import ProgressBar from '../ui/ProgressBar.vue'
import { fmtDate } from '../../utils/date.js'
import { foodLevel, levelLabel, leftText, placeColor, placeLabel, statusLabel } from '../../foodMeta.js'

const props = defineProps({ item: { type: Object, required: true } })
defineEmits(['edit', 'consume', 'discard', 'restore', 'remove', 'minus25'])

const level = computed(() => foodLevel(props.item))
const LEVEL_COLORS = { ok: '#2E9E8F', near: '#C29B26', over: '#D16B58', off: '#9CA3AF' }
const levelColor = computed(() => LEVEL_COLORS[level.value] || '#9CA3AF')
</script>

<style scoped>
.food-row {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  align-items: flex-start;
  position: relative;
  overflow: hidden;
}

.level-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}

.thumb {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  overflow: hidden;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 800;
  font-size: 20px;
  flex: none;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.name-line {
  align-items: center;
}

.f-name {
  font-size: 14.5px;
  font-weight: 800;
}

.level-chip {
  font-size: 10.5px;
  font-weight: 800;
  border-radius: 999px;
  padding: 1px 8px;
}

.level-chip.ok {
  color: #2E9E8F;
  background: color-mix(in srgb, #2E9E8F 14%, transparent);
}

.level-chip.near {
  color: var(--warn);
  background: color-mix(in srgb, var(--warn) 14%, transparent);
}

.level-chip.over {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 14%, transparent);
}

.level-chip.off {
  color: var(--muted);
  background: var(--line);
}

.off-chip {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--muted);
  background: var(--line);
  border-radius: 999px;
  padding: 1px 8px;
}

.meta-line,
.date-line {
  font-size: 12px;
  align-items: center;
}

.meta {
  color: var(--muted);
}

.place {
  font-weight: 700;
}

.left-text {
  font-weight: 800;
}

.left-text.ok {
  color: #2E9E8F;
}

.left-text.near {
  color: var(--warn);
}

.left-text.over {
  color: var(--danger);
}

.pct-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.pct-line :deep(.progress-bar),
.pct-line :deep(.bar) {
  flex: 1;
}

.pct-text {
  font-size: 11.5px;
  font-weight: 800;
  color: var(--accent-deep);
  flex: none;
}

.op {
  font-size: 10.5px;
  font-weight: 800;
}

.note {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ops {
  display: flex;
  gap: 2px;
  flex: none;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 108px;
}

.op {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--muted);
  display: grid;
  place-items: center;
}

.op:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent-deep);
}

.op.danger:hover {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}
</style>
