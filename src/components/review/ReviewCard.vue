<template>
  <div class="review-card card">
    <div class="row-between head">
      <div class="row gap10 head-left">
        <span class="mark-icon" :style="{ background: theme.bg, color: theme.fg }">{{ typeChar }}</span>
        <div>
          <div class="row gap8 title-line">
            <span class="type-name" :style="{ color: theme.fg }">{{ typeLabel }}</span>
            <span class="r-title">{{ rangeText }}</span>
          </div>
          <span class="muted small">{{ updatedText || '本地记录' }}</span>
        </div>
      </div>
      <div class="row gap4">
        <button type="button" class="mini-btn" title="编辑" @click="$emit('edit', review)">
          <Icon name="edit" :size="14" />
        </button>
        <button type="button" class="mini-btn danger" title="删除" @click="$emit('remove', review)">
          <Icon name="trash" :size="14" />
        </button>
        <button type="button" class="mini-btn" :title="open ? '收起' : '展开'" @click="open = !open">
          <Icon :name="open ? 'chevronDown' : 'chevronRight'" :size="15" />
        </button>
      </div>
    </div>

    <div v-if="linkedGoals.length" class="linked-goals">
      <span class="lg-label muted">关联目标</span>
      <span v-for="g in linkedGoals" :key="g.id" class="lg-chip" :class="{ done: g.done }">
        <Icon v-if="g.done" name="check" :size="10" />{{ g.name }}
      </span>
    </div>

    <div v-if="open" class="fields">
      <div v-for="f in fieldList" :key="f.key" class="field-block">
        <h4 class="f-name"><i class="f-dot" :style="{ background: theme.fg }" />{{ f.label }}</h4>
        <p v-if="review.fields[f.key]" class="f-body">{{ review.fields[f.key] }}</p>
        <p v-else class="muted f-empty">（未填写）</p>
      </div>
    </div>
    <p v-else class="muted summary-line">{{ summaryPreview }}</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { periodLabel, PERIOD_TYPE_LABEL, fmtDateTime } from '../../utils/date.js'
import { reviewGoals } from '../../selectors.js'
import { store } from '../../store.js'
import Icon from '../ui/Icon.vue'

const props = defineProps({
  review: { type: Object, required: true },
})

defineEmits(['edit', 'remove'])

const open = ref(true)
const linkedGoals = computed(() => reviewGoals(store.state, props.review))

// 日复盘采用日记体模块；其它周期保持原有五个模块
const DAY_FIELDS = [
  { key: 'events', label: '今天的计划？' },
  { key: 'problems', label: '今天的事件' },
  { key: 'summary', label: '今天的感受' },
  { key: 'improvement', label: '总结与改善' },
]
const PERIOD_FIELDS = [
  { key: 'plan', label: '计划内容' },
  { key: 'events', label: '当日 / 周期事件' },
  { key: 'problems', label: '新旧问题反思' },
  { key: 'improvement', label: '优化改善方案' },
  { key: 'summary', label: '整体总结' },
]
const fieldList = computed(() => (props.review.type === 'day' ? DAY_FIELDS : PERIOD_FIELDS))

const TYPE_THEME = {
  day: { bg: '#E3F5EE', fg: '#0F766E', char: '日' },
  week: { bg: '#F1E8FD', fg: '#7C3AED', char: '周' },
  month: { bg: '#E0F1FE', fg: '#0369A1', char: '月' },
  year: { bg: '#FFF0E0', fg: '#C2410C', char: '年' },
  five: { bg: '#FCE7F2', fg: '#BE185D', char: '五' },
}

const theme = computed(() => TYPE_THEME[props.review.type] || TYPE_THEME.day)
const typeChar = computed(() => theme.value.char)
const typeLabel = computed(() => PERIOD_TYPE_LABEL[props.review.type] || '')
const rangeText = computed(() => periodLabel(props.review.type, props.review.periodDate))
const updatedText = computed(() => (props.review.updatedAt ? `更新于 ${fmtDateTime(props.review.updatedAt)}` : ''))

const summaryPreview = computed(() => {
  const s = props.review.fields && props.review.fields.summary
  return s ? `总结：${s}` : '点击展开查看完整内容'
})
</script>

<style scoped>
.linked-goals {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 2px 0;
}

.lg-label {
  font-size: 11.5px;
  font-weight: 700;
}

.lg-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  padding: 2px 9px;
  border-radius: 999px;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 13%, transparent);
}

.lg-chip.done {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 14%, transparent);
  text-decoration: line-through;
}
.review-card {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.head {
  gap: 8px;
}

.head-left {
  min-width: 0;
}

.mark-icon {
  width: 40px;
  height: 40px;
  border-radius: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  font-size: 18px;
  font-weight: 800;
}

.title-line {
  flex-wrap: wrap;
  min-width: 0;
}

.type-name {
  font-size: 15.5px;
  font-weight: 800;
  flex: none;
}

.r-title {
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.small {
  font-size: 11.5px;
}

.mini-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
}

.mini-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.mini-btn.danger {
  color: var(--danger);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 11px;
  border-top: 1px dashed var(--line);
  padding-top: 11px;
}

.f-name {
  margin: 0 0 3px;
  font-size: 12.5px;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
}

.f-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
  opacity: 0.8;
}

.f-body {
  margin: 0;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
  padding-left: 13px;
}

.f-empty {
  margin: 0;
  font-size: 13px;
  padding-left: 13px;
}

.summary-line {
  margin: 0;
  font-size: 13.5px;
}
</style>
