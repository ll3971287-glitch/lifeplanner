<template>
  <BaseModal :open="open" :title="relation ? '编辑人物' : '新增人物'" @close="$emit('close')">
    <div class="rf">
      <div class="field">
        <span class="field-label">关系名称 *</span>
        <input v-model="form.name" class="input" placeholder="如：妈妈、老张、大学室友" @keyup.enter="save" />
      </div>

      <div class="row gap8">
        <div class="field grow">
          <span class="field-label">性别</span>
          <select v-model="form.gender" class="input">
            <option v-for="g in genders" :key="g.key" :value="g.key">{{ g.label }}</option>
          </select>
        </div>
        <div class="field grow">
          <span class="field-label">年龄（可手填）</span>
          <input v-model="form.age" class="input" type="number" min="0" max="150" placeholder="如 32" />
        </div>
      </div>

      <div class="field">
        <span class="field-label">生日（月/日必填，年份可选）</span>
        <div class="row gap6">
          <input v-model="form.birthYear" class="input narrow" type="number" placeholder="年" />
          <select v-model="form.birthMonth" class="input">
            <option :value="null">月</option>
            <option v-for="m in 12" :key="m" :value="m">{{ m }} 月</option>
          </select>
          <select v-model="form.birthDay" class="input">
            <option :value="null">日</option>
            <option v-for="d in 31" :key="d" :value="d">{{ d }} 日</option>
          </select>
        </div>
      </div>

      <div class="field">
        <span class="field-label">常见地点</span>
        <input v-model="form.place" class="input" placeholder="如：公司、小区球场、老家" />
      </div>

      <div class="field">
        <span class="field-label">好感度</span>
        <div class="stars row gap4">
          <button v-for="i in 5" :key="i" type="button" class="star" :class="{ on: i <= form.affinity }" @click="form.affinity = i">★</button>
          <span class="muted mini">{{ form.affinity }} / 5</span>
        </div>
      </div>

      <div class="field">
        <span class="field-label">备注（喜好 / 其他信息）</span>
        <textarea v-model="form.note" class="input ta" rows="4" placeholder="喜欢的礼物、忌口、聊天话题、要提醒自己的事…" />
      </div>

      <div class="row gap8" style="justify-content: flex-end">
        <button type="button" class="btn btn-outline btn-sm" @click="$emit('close')">取消</button>
        <button type="button" class="btn btn-primary btn-sm" :disabled="!form.name.trim()" @click="save">保存</button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import { store } from '../../store.js'
import { GENDERS } from '../../relationMeta.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  relation: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const genders = GENDERS
const form = reactive({ name: '', gender: 'other', age: '', birthYear: '', birthMonth: null, birthDay: null, place: '', affinity: 3, note: '' })

function apply(r) {
  form.name = r.name || ''
  form.gender = r.gender || 'other'
  form.age = r.age != null ? String(r.age) : ''
  form.birthYear = r.birthYear != null ? String(r.birthYear) : ''
  form.birthMonth = r.birthMonth != null ? r.birthMonth : null
  form.birthDay = r.birthDay != null ? r.birthDay : null
  form.place = r.place || ''
  form.affinity = r.affinity || 3
  form.note = r.note || ''
}

function reset() {
  form.name = ''
  form.gender = 'other'
  form.age = ''
  form.birthYear = ''
  form.birthMonth = null
  form.birthDay = null
  form.place = ''
  form.affinity = 3
  form.note = ''
}

watch(
  () => [props.open, props.relation],
  () => {
    if (!props.open) return
    if (props.relation) apply(props.relation)
    else reset()
  },
  { immediate: true }
)

function save() {
  if (!form.name.trim()) return
  const payload = {
    name: form.name.trim(),
    gender: form.gender,
    age: form.age === '' ? null : Number(form.age),
    birthYear: form.birthYear ? Number(form.birthYear) : null,
    birthMonth: form.birthMonth,
    birthDay: form.birthDay,
    place: form.place,
    affinity: form.affinity,
    note: form.note,
  }
  if (props.relation) store.updateRelation(props.relation.id, payload)
  else store.addRelation(payload)
  emit('saved')
  emit('close')
}
</script>

<style scoped>
.rf {
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

.input.narrow {
  width: 84px;
  flex: none;
}

.input.ta {
  resize: vertical;
  line-height: 1.5;
}

.grow {
  flex: 1;
}

.star {
  font-size: 20px;
  line-height: 1;
  color: var(--line);
  padding: 0 1px;
}

.star.on {
  color: var(--warn);
}

.stars {
  align-items: center;
}
</style>
