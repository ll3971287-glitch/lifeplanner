<template>
  <div class="checkin-form">
    <div class="field">
      <span class="field-label">打卡名称 *</span>
      <input v-model="form.name" class="input" placeholder="如：喝水 / 阅读 / 背单词" />
    </div>

    <div class="field">
      <span class="field-label">统计单位</span>
      <input v-model="form.unit" class="input" placeholder="杯 / 页 / 次 / 分钟" />
    </div>

    <div class="row-between dur-row">
      <span class="field-label" style="margin: 0">每次固定时长（分钟）</span>
      <Switch :model-value="durationMode" @update:model-value="durationMode = $event" />
    </div>
    <input
      v-if="durationMode"
      v-model.number="form.fixedDurationMin"
      type="number"
      min="1"
      class="input"
      placeholder="如阅读每次 30 分钟"
    />

    <div v-if="!durationMode" class="rule-sec">
      <div class="field">
        <span class="field-label">打卡规则</span>
        <SegControl
          :model-value="form.rule"
          :options="[{ label: '固定每日次数', value: 'fixed' }, { label: '计数模式', value: 'count' }]"
          @update:model-value="form.rule = $event"
        />
      </div>

      <template v-if="form.rule === 'count'">
        <div class="row-between dur-row">
          <span class="field-label" style="margin: 0">不限次数（自由记录）</span>
          <Switch v-model="form.countUnlimited" />
        </div>
        <p v-if="form.countUnlimited" class="muted tip-line">自由记录：想记多少次都行，当日有记录即视为完成。</p>
      </template>

      <div v-if="!(form.rule === 'count' && form.countUnlimited)" class="field">
        <span class="field-label">{{ form.rule === 'count' ? '每日最低次数' : '每日目标次数' }}</span>
        <input v-model.number="form.dailyTargetCount" type="number" min="1" class="input" />
      </div>
    </div>

    <div class="two-col">
      <div class="field">
        <span class="field-label">开始日期（可空）</span>
        <input type="date" class="input" :value="dateStr(form.startDate)" @change="form.startDate = $event.target.value ? parseDateStr($event.target.value) : null" />
      </div>
      <div class="field">
        <span class="field-label">结束日期（空 = 永久）</span>
        <input type="date" class="input" :value="dateStr(form.endDate)" @change="form.endDate = $event.target.value ? parseDateStr($event.target.value) : null" />
      </div>
    </div>

    <div v-if="err" class="err-text">{{ err }}</div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" @click="$emit('close')">取消</button>
      <button type="button" class="btn btn-primary" @click="save">保存</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { store } from '../../store.js'
import { fmtDate, parseDateStr } from '../../utils/date.js'
import { showToast } from '../../ui.js'
import Switch from '../ui/Switch.vue'
import SegControl from '../ui/SegControl.vue'

const props = defineProps({
  checkin: { type: Object, default: null },
})

const emit = defineEmits(['close', 'saved'])

const editing = !!props.checkin

const form = ref({
  name: props.checkin ? props.checkin.name : '',
  unit: props.checkin ? props.checkin.unit : '次',
  dailyTargetCount: props.checkin ? props.checkin.dailyTargetCount : 1,
  fixedDurationMin: props.checkin ? props.checkin.fixedDurationMin : null,
  rule: props.checkin ? props.checkin.rule || 'fixed' : 'fixed',
  countUnlimited: props.checkin ? !!props.checkin.countUnlimited : false,
  startDate: props.checkin ? props.checkin.startDate : null,
  endDate: props.checkin ? props.checkin.endDate : null,
})

const durationMode = ref(form.value.fixedDurationMin != null)
const err = ref('')

function dateStr(ts) {
  return ts == null ? '' : fmtDate(ts)
}

function save() {
  const name = form.value.name.trim()
  if (!name) {
    err.value = '请填写打卡名称'
    return
  }
  const needTarget = !(form.value.rule === 'count' && form.value.countUnlimited)
  const target = Number(form.value.dailyTargetCount)
  if (needTarget && (!target || target < 1)) {
    err.value = form.value.rule === 'count' ? '每日最低次数至少为 1' : '每日目标次数至少为 1'
    return
  }
  const payload = {
    name,
    unit: form.value.unit.trim() || '次',
    dailyTargetCount: needTarget ? target : 1,
    fixedDurationMin: durationMode.value ? Math.max(1, Number(form.value.fixedDurationMin) || 1) : null,
    rule: durationMode.value ? 'fixed' : form.value.rule === 'count' ? 'count' : 'fixed',
    countUnlimited: durationMode.value ? false : form.value.rule === 'count' && form.value.countUnlimited,
    startDate: form.value.startDate,
    endDate: form.value.endDate,
  }
  if (editing) {
    store.updateCheckin(props.checkin.id, payload)
    showToast('已保存')
  } else {
    store.addCheckin(payload)
    showToast('打卡项目已创建')
  }
  emit('saved')
  emit('close')
}
</script>

<style scoped>
.checkin-form {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.rule-sec {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.dur-row {
  padding: 2px 0;
}

.tip-line {
  margin: 0;
  font-size: 12.5px;
}

.err-text {
  color: var(--danger);
  font-size: 13px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
