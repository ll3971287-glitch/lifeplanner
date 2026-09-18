<template>
  <div class="review-form">
    <div class="field">
      <span class="field-label">复盘周期</span>
      <SegControl :model-value="form.type" :options="typeOptions" @update:model-value="onTypeChange" />
    </div>

    <div class="field">
      <span class="field-label">所属周期</span>
      <div class="row gap8 period-row">
        <input type="date" class="input" :value="fmtDate(anchorBase)" @change="onBaseDate($event.target.value)" />
        <span class="period-label muted">{{ periodLabelText }}</span>
      </div>
      <div class="quick-row">
        <button type="button" class="quick-chip" @click="shiftAnchor(-1)">上一{{ unitName }}</button>
        <button type="button" class="quick-chip" @click="shiftAnchor(1)">下一{{ unitName }}</button>
        <button type="button" class="quick-chip" @click="toNow">当前{{ unitName }}</button>
      </div>
    </div>

    <div class="field">
      <span class="field-label">计划内容</span>
      <textarea v-model="form.fields.plan" class="textarea" rows="3" placeholder="这个周期计划了什么？" />
    </div>

    <div class="field">
      <div class="row-between" style="margin-bottom: 6px">
        <span class="field-label" style="margin: 0">当日 / 周期事件</span>
        <button type="button" class="btn btn-sm btn-outline" @click="insertCompleted">
          <Icon name="check" :size="13" /> 插入本周期完成情况
        </button>
      </div>
      <textarea v-model="form.fields.events" class="textarea" rows="4" placeholder="发生了什么、完成了什么、遇到了什么" />
    </div>

    <div class="field">
      <span class="field-label">新旧问题反思</span>
      <textarea v-model="form.fields.problems" class="textarea" rows="3" placeholder="哪些问题依然存在？哪些是新出现的？" />
    </div>

    <div class="field">
      <span class="field-label">优化改善方案</span>
      <textarea v-model="form.fields.improvement" class="textarea" rows="3" placeholder="下一步怎么改进？" />
    </div>

    <div class="field">
      <span class="field-label">关联目标（只读引用，改复盘不会改动目标数据）</span>
      <div v-if="pickableGoals.length" class="goal-pick">
        <button
          v-for="g in pickableGoals"
          :key="g.id"
          type="button"
          class="goal-chip"
          :class="{ on: form.goals.includes(g.id), done: g.done }"
          @click="toggleGoal(g.id)"
        >
          <Icon v-if="g.done" name="check" :size="11" />
          <span class="gk-name">{{ g.name }}</span>
          <span class="gk-period muted">{{ periodShortLabel(g) }}</span>
        </button>
      </div>
      <p v-else class="muted rule-tip">这个周期还没有目标，可先到「目标」板块添加。</p>
    </div>

    <div class="field">
      <span class="field-label">整体总结</span>
      <textarea v-model="form.fields.summary" class="textarea" rows="3" placeholder="一句话总结这个周期" />
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" @click="$emit('close')">取消</button>
      <button type="button" class="btn btn-primary" @click="save">保存复盘</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store } from '../../store.js'
import {
  PERIOD_TYPES,
  PERIOD_TYPE_LABEL,
  periodAnchorTs,
  periodLabel,
  periodRangeTs,
  addDaysTs,
  addMonthsTs,
  addYearsTs,
  fmtDate,
  parseDateStr,
} from '../../utils/date.js'
import { completedTodosInRange, archivedProjectsInRange } from '../../selectors.js'
import { periodShort, goalScopeForReview } from '../../goalMeta.js'
import { showToast } from '../../ui.js'
import SegControl from '../ui/SegControl.vue'
import Icon from '../ui/Icon.vue'

const props = defineProps({
  review: { type: Object, default: null },
  defaultType: { type: String, default: 'day' },
})

const emit = defineEmits(['close', 'saved'])

const editing = !!props.review

const typeOptions = PERIOD_TYPES.map((t) => ({ label: PERIOD_TYPE_LABEL[t], value: t }))

const form = ref({
  type: props.review ? props.review.type : props.defaultType,
  anchorBase: props.review ? props.review.periodDate : Date.now(),
  fields: props.review
    ? { ...props.review.fields }
    : { plan: '', events: '', problems: '', improvement: '', summary: '' },
  goals: props.review && Array.isArray(props.review.goals) ? [...props.review.goals] : [],
})

// 可关联的目标：日/周/月复盘 → 当月目标；年/五年复盘 → 该年全部目标
const pickableGoals = computed(() => {
  const d = new Date(form.value.anchorBase)
  const year = d.getFullYear()
  const month = d.getMonth()
  const scopeFor = goalScopeForReview(form.value.type)
  if (scopeFor === 'year') return store.state.goals.filter((g) => g.year === year)
  return store.state.goals.filter((g) => g.year === year && g.scope === 'month' && g.index === month)
})
function periodShortLabel(g) {
  return periodShort(g.year, g.scope, g.index)
}
function toggleGoal(id) {
  const i = form.value.goals.indexOf(id)
  if (i >= 0) form.value.goals.splice(i, 1)
  else form.value.goals.push(id)
}

const UNIT = { day: '日', week: '周', month: '月', year: '年', five: '五年' }

const unitName = computed(() => UNIT[form.value.type] || '周期')

const anchor = computed(() => periodAnchorTs(form.value.type, form.value.anchorBase))

const periodLabelText = computed(() => periodLabel(form.value.type, anchor.value))

function onTypeChange(t) {
  form.value.type = t
}

function onBaseDate(v) {
  if (v) form.value.anchorBase = parseDateStr(v)
}

function shiftAnchor(dir) {
  const base = anchor.value
  const t = form.value.type
  if (t === 'day') form.value.anchorBase = addDaysTs(base, dir)
  else if (t === 'week') form.value.anchorBase = addDaysTs(base, dir * 7)
  else if (t === 'month') form.value.anchorBase = addMonthsTs(base, dir)
  else if (t === 'year') form.value.anchorBase = addYearsTs(base, dir)
  else form.value.anchorBase = addYearsTs(base, dir * 5)
}

function toNow() {
  form.value.anchorBase = Date.now()
}

function insertCompleted() {
  const [s, e] = periodRangeTs(form.value.type, anchor.value)
  const todos = completedTodosInRange(store.state, s, e)
  const projects = archivedProjectsInRange(store.state, s, e)
  if (!todos.length && !projects.length) {
    showToast('该周期内暂无完成记录', 'err')
    return
  }
  const lines = []
  for (const t of todos) {
    lines.push(`- 完成任务「${t.title}」（${fmtDate(t.completedAt)}）`)
  }
  for (const p of projects) {
    lines.push(`- 归档项目「${p.name}」`)
  }
  const text = lines.join('\n')
  form.value.fields.events = form.value.fields.events ? `${form.value.fields.events}\n${text}` : text
  showToast('已插入完成记录')
}

function save() {
  const payload = {
    type: form.value.type,
    periodDate: anchor.value,
    fields: form.value.fields,
    goals: [...form.value.goals],
  }
  if (editing) {
    store.updateReview(props.review.id, payload)
    showToast('已保存')
  } else {
    store.addReview(payload)
    showToast('复盘已保存')
  }
  emit('saved')
  emit('close')
}
</script>

<style scoped>
.review-form {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.period-row {
  flex-wrap: wrap;
}

.period-row .input {
  width: auto;
}

.period-label {
  font-size: 13px;
  font-weight: 600;
}

.quick-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.quick-chip {
  padding: 5px 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 35%, transparent);
  color: var(--primary-deep);
  font-size: 12.5px;
  font-weight: 600;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
