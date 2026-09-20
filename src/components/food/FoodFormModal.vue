<template>
  <BaseModal :open="open" :title="item ? '编辑食物' : '新增食物'" @close="$emit('close')">
    <div class="ff">
      <div class="field">
        <span class="field-label">食物名称 *</span>
        <input v-model="form.name" class="input" placeholder="如：鸡胸肉、牛奶" @keyup.enter="save" />
      </div>

      <div class="two-col">
        <div class="field">
          <span class="field-label">食物分类</span>
          <select v-model="form.category" class="input">
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="field">
          <span class="field-label">存放位置</span>
          <SegControl v-model="form.place" :options="placeOptions" />
        </div>
      </div>

      <div class="field">
        <span class="field-label">开封状态</span>
        <SegControl
          :model-value="form.opened ? 'open' : 'closed'"
          :options="[{ label: '未开封', value: 'closed' }, { label: '已开封', value: 'open' }]"
          @update:model-value="form.opened = $event === 'open'"
        />
      </div>

      <div class="two-col">
        <div class="field">
          <span class="field-label">入库时间</span>
          <input type="date" class="input" :value="dateStr(form.storedAt)" @change="onStoredChange($event.target.value)" />
        </div>
        <div class="field">
          <span class="field-label">过期时间{{ autoSuggest ? '（自动建议）' : '（已手动指定）' }}</span>
          <input type="date" class="input" :value="dateStr(form.expireAt)" @change="onExpireChange($event.target.value)" />
        </div>
      </div>
      <p class="muted mini hint">
        <template v-if="suggestDaysValue != null">
          按「{{ form.category }} + {{ placeLabelOf(form.place) }} + {{ form.opened ? '已开封' : '未开封' }}」建议保质期 <b>{{ suggestDaysValue }} 天</b>；
        </template>
        <template v-else>该分类在此存放位置无参考保质期，请手动填写；</template>
        <button v-if="!autoSuggest" type="button" class="link-btn" @click="resetToSuggest">恢复自动建议</button>
      </p>

      <div class="field">
        <span class="field-label">图片</span>
        <div class="row gap8 img-row">
          <div class="thumb" :style="{ background: form.imageUrl ? 'transparent' : placeColorOf(form.place) }">
            <img v-if="form.imageUrl" :src="form.imageUrl" alt="" />
            <span v-else>{{ (form.name || '?').slice(0, 1) }}</span>
          </div>
          <div class="img-tools">
            <input
              v-if="!isLocalImage"
              v-model="form.imageUrl"
              class="input"
              placeholder="粘贴图片链接 https://…"
            />
            <p v-else class="muted mini">已选择本地图片（已压缩保存）</p>
            <div class="row gap6">
              <button type="button" class="btn btn-outline btn-sm" @click="pickFile">
                <Icon name="upload" :size="13" /> 从相册选择
              </button>
              <button v-if="form.imageUrl" type="button" class="btn btn-outline btn-sm" @click="form.imageUrl = ''">移除图片</button>
            </div>
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />
          </div>
        </div>
      </div>

      <div class="field">
        <span class="field-label">备注</span>
        <textarea v-model="form.note" class="input ta" rows="3" placeholder="如：买了 2 斤、放在上层、给宝宝的…" />
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
import {
  FOOD_CATEGORIES,
  FOOD_PLACES,
  placeLabel as placeLabelOf,
  placeColor as placeColorOf,
  suggestDays,
  suggestExpireAt,
} from '../../foodMeta.js'
import { fmtDate, parseDateStr, startOfDayTs } from '../../utils/date.js'
import { showToast } from '../../ui.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  item: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const categories = FOOD_CATEGORIES
const placeOptions = FOOD_PLACES.map((p) => ({ label: p.label, value: p.key }))

const empty = () => ({
  name: '',
  category: '其他',
  place: 'fridge',
  opened: false,
  storedAt: startOfDayTs(Date.now()),
  expireAt: suggestExpireAt(Date.now(), '其他', 'fridge', false),
  imageUrl: '',
  note: '',
})

const form = reactive(empty())
const autoSuggest = ref(true)
const fileInput = ref(null)

const suggestDaysValue = computed(() => suggestDays(form.category, form.place, form.opened))
const isLocalImage = computed(() => form.imageUrl.startsWith('data:'))

function apply(f) {
  Object.assign(form, empty())
  if (!f) {
    autoSuggest.value = true
    return
  }
  form.name = f.name
  form.category = f.category
  form.place = f.place
  form.opened = !!f.opened
  form.storedAt = f.storedAt
  form.expireAt = f.expireAt
  form.imageUrl = f.imageUrl || ''
  form.note = f.note || ''
  // 编辑已有记录时尊重已保存的过期时间
  autoSuggest.value = false
}

watch(
  () => [props.open, props.item],
  () => {
    if (!props.open) return
    apply(props.item)
  },
  { immediate: true }
)

// 分类 / 位置 / 开封 / 入库日期变化 → 自动刷新建议过期时间
watch(
  () => [form.category, form.place, form.opened, form.storedAt],
  () => {
    if (!autoSuggest.value) return
    form.expireAt = suggestExpireAt(form.storedAt || Date.now(), form.category, form.place, form.opened)
  }
)

function dateStr(ts) {
  return ts == null ? '' : fmtDate(ts)
}
function onStoredChange(v) {
  form.storedAt = v ? parseDateStr(v) : null
}
function onExpireChange(v) {
  autoSuggest.value = false
  form.expireAt = v ? parseDateStr(v) : null
}
function resetToSuggest() {
  autoSuggest.value = true
  form.expireAt = suggestExpireAt(form.storedAt || Date.now(), form.category, form.place, form.opened)
  showToast('已恢复自动建议的过期时间')
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
    form.imageUrl = await compressImage(file)
    showToast('图片已压缩保存')
  } catch (err) {
    showToast('图片处理失败，请改用图片链接', 'err')
  }
}

function save() {
  if (!form.name.trim()) return
  const payload = {
    name: form.name.trim(),
    category: form.category,
    place: form.place,
    opened: form.opened,
    storedAt: form.storedAt,
    expireAt: form.expireAt,
    imageUrl: form.imageUrl,
    note: form.note,
  }
  if (props.item) store.updateFood(props.item.id, payload)
  else store.addFood(payload)
  emit('saved')
  emit('close')
}
</script>

<style scoped>
.ff {
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

.hint {
  margin: 0;
}

.link-btn {
  color: var(--accent-deep);
  font-weight: 700;
  font-size: 12px;
  text-decoration: underline;
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
  color: #fff;
  font-weight: 800;
  font-size: 22px;
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
</style>
