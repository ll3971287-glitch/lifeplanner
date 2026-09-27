<template>
  <BaseModal :open="open" :title="item ? '编辑其他预算' : '新增其他预算'" @close="$emit('close')">
    <div class="ob">
      <div class="field">
        <span class="field-label">名称 *</span>
        <input v-model="form.name" class="input" placeholder="如：房租、通勤、日用采购" @keyup.enter="save" />
      </div>

      <div class="field">
        <span class="field-label">金额（元）</span>
        <input v-model.number="form.amount" type="number" min="0" step="10" class="input" placeholder="如：1500" />
      </div>

      <div class="field">
        <span class="field-label">大致时间预估</span>
        <SegControl v-model="form.timeHint" :options="timeHintOptions" />
        <p class="muted mini">只需模糊估算：一季度后 / 半年后 / 1 年后 / 若干年后。</p>
      </div>

      <div class="field">
        <span class="field-label">备注（可选）</span>
        <textarea v-model="form.note" class="input ta" rows="2" placeholder="补充说明，如：每月固定支出" />
      </div>

      <p class="muted mini">这些金额只记录展示，会与奖励的预估预算一起计入顶部「预估预算合计」，不参与兑换判定。</p>

      <div class="row gap8" style="justify-content: flex-end">
        <button type="button" class="btn btn-outline btn-sm" @click="$emit('close')">取消</button>
        <button type="button" class="btn btn-primary btn-sm" :disabled="!form.name.trim()" @click="save">保存</button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup>
import { reactive, watch } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import SegControl from '../ui/SegControl.vue'
import { store } from '../../store.js'
import { TIME_HINT_OPTIONS } from '../../rewardMeta.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  item: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const form = reactive({ name: '', amount: 0, note: '', timeHint: '' })
const timeHintOptions = TIME_HINT_OPTIONS

watch(
  () => [props.open, props.item],
  () => {
    if (!props.open) return
    form.name = props.item ? props.item.name : ''
    form.amount = props.item ? props.item.amount : 0
    form.note = props.item ? props.item.note || '' : ''
    form.timeHint = props.item ? props.item.timeHint || '' : ''
  },
  { immediate: true }
)

function save() {
  if (!form.name.trim()) return
  const payload = {
    name: form.name.trim(),
    amount: Math.max(0, Number(form.amount) || 0),
    note: form.note,
    timeHint: form.timeHint,
  }
  if (props.item) store.updateOtherBudget(props.item.id, payload)
  else store.addOtherBudget(payload)
  emit('saved')
  emit('close')
}
</script>

<style scoped>
.ob {
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

.mini {
  font-size: 11.5px;
  margin: 0;
}
</style>
