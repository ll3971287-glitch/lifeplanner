<template>
  <BaseModal :open="open" :title="checkin ? `打卡：${checkin.name}` : '打卡'" @close="$emit('close')">
    <div class="record-form">
      <div v-if="checkin && checkin.fixedDurationMin" class="hint-box">
        <p class="muted" style="margin: 0">目标每次 {{ checkin.fixedDurationMin }} 分钟，本次计时多少分钟？</p>
      </div>
      <div v-else class="hint-box">
        <p class="muted" style="margin: 0">本次完成 {{ checkin && checkin.unit }} 数</p>
      </div>

      <div v-if="checkin && checkin.fixedDurationMin" class="duration-inputs">
        <div class="quick-row">
          <button v-for="m in [15, 30, 45, 60]" :key="m" type="button" class="quick-chip" @click="minutes = m">{{ m }} 分</button>
        </div>
        <div class="row gap8">
          <input v-model.number="minutes" type="number" min="1" class="input" />
          <span class="muted">分钟</span>
        </div>
      </div>

      <div v-else class="count-inputs">
        <input v-model.number="count" type="number" min="1" class="input" />
      </div>

      <div class="field">
        <span class="field-label">日志备注（可选）</span>
        <textarea v-model="note" class="textarea" rows="2" placeholder="今天的感受 / 具体情况" />
      </div>

      <div class="actions">
        <button type="button" class="btn btn-ghost" @click="$emit('close')">取消</button>
        <button type="button" class="btn btn-primary btn-lg" @click="submit">记一次打卡</button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store } from '../../store.js'
import { showToast } from '../../ui.js'
import BaseModal from '../ui/BaseModal.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  checkinId: { type: String, default: null },
})

const emit = defineEmits(['close', 'recorded'])

const checkin = computed(() => store.state.checkins.find((c) => c.id === props.checkinId) || null)
const minutes = ref(30)
const count = ref(1)
const note = ref('')

function submit() {
  const c = checkin.value
  if (!c) return
  const payload = { note: note.value }
  if (c.fixedDurationMin) {
    const m = Math.max(1, Math.round(minutes.value) || 0)
    payload.durationMin = m
    store.addCheckinRecord(c.id, payload)
    showToast(`已记录 ${m} 分钟`)
  } else {
    const n = Math.max(1, Math.round(count.value) || 1)
    payload.count = n
    store.addCheckinRecord(c.id, payload)
    showToast(`已打卡 ${n} ${c.unit}`)
  }
  note.value = ''
  emit('recorded')
  emit('close')
}
</script>

<style scoped>
.record-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.hint-box {
  background: color-mix(in srgb, var(--primary) 20%, transparent);
  border-radius: 10px;
  padding: 10px 12px;
}

.quick-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-chip {
  padding: 6px 14px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 35%, transparent);
  color: var(--primary-deep);
  font-weight: 700;
  font-size: 13px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
