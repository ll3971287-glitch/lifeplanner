<template>
  <BaseModal :open="open" :title="reward ? '编辑奖励' : '新增奖励'" @close="$emit('close')">
    <div class="rf">
      <div class="field">
        <span class="field-label">奖励名称 *</span>
        <input v-model="form.name" class="input" placeholder="如：看一场电影、喝一杯奶茶" @keyup.enter="save" />
      </div>

      <div class="field">
        <span class="field-label">图标</span>
        <div class="icon-row">
          <button
            v-for="ic in iconChoices"
            :key="ic"
            type="button"
            class="icon-opt"
            :class="{ on: form.icon === ic }"
            @click="form.icon = ic"
          >
            {{ ic }}
          </button>
          <input v-model="form.icon" class="input icon-input" maxlength="4" placeholder="自定义" />
        </div>
      </div>

      <div class="two-col">
        <div class="field">
          <span class="field-label">花费（金币）</span>
          <input v-model.number="form.cost" type="number" min="0" step="5" class="input" />
        </div>
        <div class="field">
          <span class="field-label">稀有度</span>
          <SegControl v-model="form.rarity" :options="rarityOptions" />
        </div>
      </div>

      <div class="field">
        <span class="field-label">描述</span>
        <textarea v-model="form.desc" class="input ta" rows="2" placeholder="这个奖励是什么？为什么想要它？" />
      </div>

      <div class="field">
        <span class="field-label">奖励预览</span>
        <div class="row gap8 img-row">
          <div class="thumb">
            <img v-if="form.previewImage" :src="form.previewImage" alt="奖励预览" />
            <span v-else>{{ form.icon || '🎁' }}</span>
          </div>
          <div class="img-tools">
            <input v-if="!isLocalImage" v-model="form.previewImage" class="input" placeholder="粘贴图片链接 https://…" />
            <p v-else class="muted mini">已选择本地图片（已压缩保存）</p>
            <div class="row gap6">
              <button type="button" class="btn btn-outline btn-sm" @click="pickFile">
                <Icon name="upload" :size="13" /> 从相册选择
              </button>
              <button v-if="form.previewImage" type="button" class="btn btn-outline btn-sm" @click="form.previewImage = ''">移除图片</button>
            </div>
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />
          </div>
        </div>
        <input v-model="form.previewNote" class="input" placeholder="预览说明（可选），如：周六晚上、影院 / 家庭影院" />
      </div>

      <div class="field">
        <span class="field-label">解锁条件（三选一）</span>
        <SegControl v-model="form.conditionType" :options="conditionOptions" />
      </div>

      <div class="field">
        <template v-if="form.conditionType === 'focus'">
          <span class="field-label">累计专注达到（分钟）</span>
          <input v-model.number="form.conditionValue" type="number" min="0" step="10" class="input" />
        </template>
        <template v-else-if="form.conditionType === 'todos'">
          <span class="field-label">累计完成任务达到（个）</span>
          <input v-model.number="form.conditionValue" type="number" min="0" step="1" class="input" />
        </template>
        <template v-else>
          <span class="field-label">自定义条件</span>
          <input v-model="form.conditionText" class="input" placeholder="如：连续一周早起打卡" />
        </template>
        <p class="muted mini">{{ conditionHint }}</p>
      </div>

      <div class="field">
        <span class="field-label">限定兑换时间（可留空表示不限）</span>
        <div class="two-col">
          <div class="date-cell">
            <input type="date" class="input" :value="dateStr(form.unlockFrom)" @change="onFromChange($event.target.value)" />
            <button v-if="form.unlockFrom != null" type="button" class="link-btn" @click="form.unlockFrom = null">清除</button>
            <span class="muted mini">此日之后可兑换</span>
          </div>
          <div class="date-cell">
            <input type="date" class="input" :value="dateStr(form.unlockUntil)" @change="onUntilChange($event.target.value)" />
            <button v-if="form.unlockUntil != null" type="button" class="link-btn" @click="form.unlockUntil = null">清除</button>
            <span class="muted mini">此日之前可兑换</span>
          </div>
        </div>
      </div>

      <div class="row gap8" style="justify-content: flex-end">
        <button type="button" class="btn btn-outline btn-sm" @click="$emit('close')">取消</button>
        <button type="button" class="btn btn-primary btn-sm" :disabled="!form.name.trim()" @click="save">保存</button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import SegControl from '../ui/SegControl.vue'
import Icon from '../ui/Icon.vue'
import { store } from '../../store.js'
import { ICON_CHOICES, RARITY_OPTIONS, CONDITION_OPTIONS, CONDITION_TYPES } from '../../rewardMeta.js'
import { fmtDate, parseDateStr } from '../../utils/date.js'
import { showToast } from '../../ui.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  reward: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const iconChoices = ICON_CHOICES
const rarityOptions = RARITY_OPTIONS
const conditionOptions = CONDITION_OPTIONS

const empty = () => ({
  name: '',
  icon: ICON_CHOICES[0],
  desc: '',
  cost: 50,
  rarity: 'common',
  previewImage: '',
  previewNote: '',
  conditionType: 'focus',
  conditionValue: 300,
  conditionText: '',
  unlockFrom: null,
  unlockUntil: null,
})

const form = reactive(empty())
const fileInput = ref(null)
const isLocalImage = computed(() => form.previewImage.startsWith('data:'))
const conditionHint = computed(() => (CONDITION_TYPES.find((c) => c.key === form.conditionType) || {}).hint || '')

function apply(r) {
  Object.assign(form, empty())
  if (!r) return
  form.name = r.name
  form.icon = r.icon || ICON_CHOICES[0]
  form.desc = r.desc || ''
  form.cost = r.cost || 0
  form.rarity = r.rarity || 'common'
  form.previewImage = r.previewImage || ''
  form.previewNote = r.previewNote || ''
  form.conditionType = r.conditionType || 'focus'
  form.conditionValue = r.conditionValue || 0
  form.conditionText = r.conditionText || ''
  form.unlockFrom = r.unlockFrom == null ? null : r.unlockFrom
  form.unlockUntil = r.unlockUntil == null ? null : r.unlockUntil
}

watch(
  () => [props.open, props.reward],
  () => {
    if (!props.open) return
    apply(props.reward)
  },
  { immediate: true }
)

function dateStr(ts) {
  return ts == null ? '' : fmtDate(ts)
}
function onFromChange(v) {
  form.unlockFrom = v ? parseDateStr(v) : null
}
function onUntilChange(v) {
  form.unlockUntil = v ? parseDateStr(v) : null
}

// 本地图片：压缩到最长边 640、jpeg 0.72，存为 dataURL
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const maxSide = 640
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

function pickFile() {
  if (fileInput.value) fileInput.value.click()
}
async function onFileChange(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  try {
    form.previewImage = await compressImage(file)
    showToast('图片已压缩保存')
  } catch (err) {
    showToast('图片处理失败，请改用图片链接', 'err')
  }
}

function save() {
  if (!form.name.trim()) return
  const payload = {
    name: form.name.trim(),
    icon: form.icon || ICON_CHOICES[0],
    desc: form.desc,
    cost: Math.max(0, Math.round(Number(form.cost) || 0)),
    rarity: form.rarity,
    previewImage: form.previewImage,
    previewNote: form.previewNote,
    conditionType: form.conditionType,
    conditionValue: Math.max(0, Math.round(Number(form.conditionValue) || 0)),
    conditionText: form.conditionText,
    unlockFrom: form.unlockFrom,
    unlockUntil: form.unlockUntil,
  }
  if (props.reward) store.updateReward(props.reward.id, payload)
  else store.addReward(payload)
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

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
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

.icon-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.icon-opt {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--panel);
  font-size: 17px;
  display: grid;
  place-items: center;
}

.icon-opt.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}

.icon-input {
  width: 76px;
  text-align: center;
}

.img-row {
  align-items: flex-start;
}

.thumb {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--line) 45%, transparent);
  font-size: 24px;
  flex: none;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.img-tools {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hidden {
  display: none;
}

.mini {
  font-size: 11.5px;
  margin: 0;
}

.date-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.link-btn {
  align-self: flex-start;
  color: var(--accent-deep);
  font-weight: 700;
  font-size: 12px;
  text-decoration: underline;
}
</style>
