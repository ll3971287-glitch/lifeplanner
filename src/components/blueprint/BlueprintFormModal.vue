<template>
  <BaseModal :open="open" :title="blueprint ? '编辑蓝图' : '新建未来蓝图'" @close="$emit('close')">
    <div class="bf-form">
      <div class="field">
        <span class="field-label">标题 *</span>
        <input v-model="form.title" class="input" placeholder="你想达成的目标 / 愿景" @keyup.enter="save" />
      </div>

      <div class="field">
        <span class="field-label">期望达成时间段</span>
        <div class="seg-row row gap4">
          <button v-for="m in timeModes" :key="m.key" type="button" class="chip" :class="{ on: mode === m.key }" @click="mode = m.key">
            {{ m.label }}
          </button>
        </div>
        <template v-if="mode === 'range'">
          <div class="row gap6 range-row">
            <label class="range-side">
              <span class="mini muted">起始（可选）</span>
              <input v-model="dateStartStr" type="date" class="input" />
            </label>
            <span class="tilde">~</span>
            <label class="range-side">
              <span class="mini muted">期望达成 *</span>
              <input v-model="dateEndStr" type="date" class="input" />
            </label>
          </div>
          <span class="muted mini">用时间段规划，如「今年底 ~ 后年春天」；仅填截止也代表到该时间点为止</span>
        </template>
        <template v-else-if="mode === 'est'">
          <div class="row gap6">
            <select v-model="yearsAhead" class="input grow">
              <option v-for="y in [1, 2, 3, 5, 10, 15, 20]" :key="y" :value="y">约 {{ y }} 年后</option>
            </select>
            <span class="muted mini">按今日估算截止日期放入时间轴</span>
          </div>
        </template>
        <template v-else>
          <input v-model="form.goalText" class="input" placeholder="模糊时间，如：退休前、三十岁前…（不占时间轴）" />
        </template>
      </div>

      <div class="field">
        <span class="field-label">人生维度</span>
        <select v-model="form.dimension" class="input">
          <option value="">未分组</option>
          <option v-for="d in allDims" :key="d.id" :value="d.id">{{ d.label }}</option>
        </select>
        <p v-if="store.state.settings.blueprintDims && store.state.settings.blueprintDims.length" class="muted mini">自定义维度可在蓝图页「管理维度」中添加</p>
      </div>

      <div class="field">
        <span class="field-label">状态</span>
        <select v-model="form.status" class="input">
          <option v-for="k in statusOrder" :key="k" :value="k">{{ statusOf(k).label }}</option>
        </select>
      </div>

      <div class="field">
        <span class="field-label">蓝图等级（进度条按尺寸区分优先级）</span>
        <div class="row gap4 seg-row">
          <button
            v-for="k in levelKeys"
            :key="k"
            type="button"
            class="chip"
            :class="{ on: form.level === k }"
            @click="form.level = k"
          >
            {{ levelText(k) }}
          </button>
        </div>
      </div>

      <div class="field">
        <span class="field-label">详细描述</span>
        <textarea v-model="form.desc" class="input ta" rows="4" placeholder="这个愿景具体是什么？为什么重要？" />
      </div>

      <div class="row gap8" style="justify-content: flex-end; margin-top: 6px">
        <button type="button" class="btn btn-outline btn-sm" @click="$emit('close')">取消</button>
        <button type="button" class="btn btn-primary btn-sm" :disabled="!form.title.trim()" @click="save">保存</button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import { store } from '../../store.js'
import { BUILTIN_DIMS, BLUEPRINT_STATUS, STATUS_ORDER, LEVEL_ORDER, BLUEPRINT_LEVELS, allDims as collectDims } from '../../blueprintMeta.js'
import { fmtDate, parseDateStr } from '../../utils/date.js'
import { showToast } from '../../ui.js'
import { goalStart, goalEnd } from '../../blueprintMeta.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  blueprint: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const timeModes = [
  { key: 'range', label: '时间段' },
  { key: 'est', label: '约 N 年后' },
  { key: 'text', label: '模糊时间' },
]
const statusOrder = STATUS_ORDER
const levelKeys = LEVEL_ORDER
const levelText = (k) => (BLUEPRINT_LEVELS[k] || BLUEPRINT_LEVELS.small).label

const statusOf = (k) => BLUEPRINT_STATUS[k] || BLUEPRINT_STATUS.idea
const allDims = computed(() => collectDims(store.state))

const form = reactive({ title: '', goalStartTs: null, goalEndTs: null, goalText: '', dimension: '', desc: '', status: 'idea', level: 'small' })
const mode = ref('range')
const dateStartStr = ref('')
const dateEndStr = ref('')
const yearsAhead = ref(5)

function apply(b) {
  form.title = b.title
  form.desc = b.desc || ''
  form.dimension = b.dimension || ''
  form.status = b.status || 'idea'
  form.level = b.level || 'small'
  form.goalStartTs = goalStart(b)
  form.goalEndTs = goalEnd(b)
  form.goalText = b.goalText || ''
  const endTs = goalEnd(b)
  if (form.goalText && /^约\s*\d+\s*年后$/.test(form.goalText)) {
    mode.value = 'est'
    yearsAhead.value = Number(form.goalText.match(/\d+/)[0])
  } else if (form.goalText && endTs == null) {
    mode.value = 'text'
  } else {
    mode.value = 'range'
    dateEndStr.value = endTs != null ? fmtDate(endTs) : ''
    dateStartStr.value = goalStart(b) != null ? fmtDate(goalStart(b)) : ''
  }
}

function reset() {
  form.title = ''
  form.desc = ''
  form.dimension = ''
  form.status = 'idea'
  form.level = 'small'
  form.goalStartTs = null
  form.goalEndTs = null
  form.goalText = ''
  mode.value = 'range'
  dateStartStr.value = ''
  dateEndStr.value = ''
  yearsAhead.value = 5
}

function syncByMode() {
  form.goalText = form.goalText || ''
  if (mode.value === 'range') {
    form.goalStartTs = dateStartStr.value ? parseDateStr(dateStartStr.value) : null
    form.goalEndTs = dateEndStr.value ? parseDateStr(dateEndStr.value) : null
    form.goalText = ''
    if (form.goalStartTs && form.goalEndTs && form.goalStartTs > form.goalEndTs) return 'startAfterEnd'
  } else if (mode.value === 'est') {
    const d = new Date()
    d.setFullYear(d.getFullYear() + yearsAhead.value)
    d.setHours(0, 0, 0, 0)
    form.goalStartTs = null
    form.goalEndTs = d.getTime()
    form.goalText = `约 ${yearsAhead.value} 年后`
  } else {
    form.goalStartTs = null
    form.goalEndTs = null
  }
  return null
}

// 每次打开面板时按对象装载：编辑蓝图回填，新建清空（支持对同一组件二次编辑）
watch(
  () => [props.open, props.blueprint],
  () => {
    if (!props.open) return
    if (props.blueprint) apply(props.blueprint)
    else reset()
  },
  { immediate: true }
)

function save() {
  if (!form.title.trim()) return
  const err = syncByMode()
  if (err === 'startAfterEnd') {
    showToast('起始日期不能晚于期望达成日期', 'err')
    return
  }
  const payload = {
    title: form.title.trim(),
    desc: form.desc,
    dimension: form.dimension,
    status: form.status,
    level: form.level,
    goalStartTs: form.goalStartTs,
    goalEndTs: form.goalEndTs,
    goalText: form.goalText,
  }
  if (props.blueprint) store.updateBlueprint(props.blueprint.id, payload)
  else store.addBlueprint(payload)
  emit('saved', { id: props.blueprint ? props.blueprint.id : undefined })
  reset()
}
</script>

<style scoped>
.bf-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--muted);
}

.input {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
}

.input.ta {
  resize: vertical;
  line-height: 1.5;
}

.grow {
  flex: 1;
}

.mini {
  font-size: 12px;
}

.seg-row {
  flex-wrap: wrap;
}

.chip {
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12.5px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--muted);
}

.chip.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--text);
  font-weight: 700;
}
.range-row {
  align-items: flex-end;
}

.range-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.tilde {
  padding-bottom: 9px;
  color: var(--muted);
}
</style>
