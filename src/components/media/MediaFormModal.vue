<template>
  <BaseModal :open="open" :title="item ? '编辑记录' : '新增记录'" @close="$emit('close')">
    <div class="mf">
      <div class="field">
        <span class="field-label">品类</span>
        <SegControl v-model="form.category" :options="catOptions" />
      </div>

      <div class="field">
        <span class="field-label">名称 *</span>
        <input v-model="form.title" class="input" :placeholder="titlePlaceholder" @keyup.enter="save" />
      </div>

      <div class="two-col">
        <div class="field">
          <span class="field-label">{{ creatorLabel }}</span>
          <input v-model="form.creator" class="input" :placeholder="creatorPlaceholder" />
        </div>
        <div class="field">
          <span class="field-label">封面图片链接</span>
          <input v-model="form.coverUrl" class="input" placeholder="https://…（可留空）" />
        </div>
      </div>

      <div class="field">
        <span class="field-label">状态</span>
        <SegControl :model-value="form.status" :options="statusOptions" @update:model-value="form.status = $event" />
      </div>

      <!-- 品类专属字段 -->
      <div v-if="form.category === 'book'" class="two-col">
        <div class="field">
          <span class="field-label">总页数</span>
          <input v-model.number="form.totalPages" type="number" min="0" class="input" placeholder="如 320" />
        </div>
        <div class="field">
          <span class="field-label">已读页数</span>
          <input v-model.number="form.currentPage" type="number" min="0" class="input" placeholder="如 120" />
        </div>
      </div>

      <div v-else-if="form.category === 'series' || form.category === 'anime'" class="two-col">
        <div class="field">
          <span class="field-label">总集数</span>
          <input v-model.number="form.totalEpisodes" type="number" min="0" class="input" placeholder="如 24" />
        </div>
        <div class="field">
          <span class="field-label">已看集数</span>
          <input v-model.number="form.watchedEpisodes" type="number" min="0" class="input" placeholder="如 8" />
        </div>
      </div>

      <template v-else-if="form.category === 'game'">
        <div class="field">
          <span class="field-label">游玩时长（小时）</span>
          <input v-model.number="form.playHours" type="number" min="0" step="0.5" class="input" placeholder="如 32.5" />
        </div>
        <div class="field">
          <span class="field-label">关卡记录（逗号或换行分隔）</span>
          <textarea v-model="form.levels" class="input ta" rows="2" placeholder="如：序章、第二关、Boss 战" />
        </div>
      </template>

      <div class="field">
        <span class="field-label">五星评分</span>
        <div class="row gap4 stars">
          <button v-for="i in 5" :key="i" type="button" class="star" :class="{ on: i <= form.rating }" @click="form.rating = form.rating === i ? 0 : i">★</button>
          <span class="muted mini">{{ form.rating }} / 5（再点一次可选清零）</span>
        </div>
      </div>

      <div class="field">
        <span class="field-label">个人专属标签</span>
        <div class="row gap6">
          <input v-model="tagInput" class="input" placeholder="输入后回车添加，如：治愈、悬疑" @keyup.enter="addTag" />
          <button type="button" class="btn btn-outline btn-sm" @click="addTag">添加</button>
        </div>
        <div v-if="form.tags.length" class="row gap4 wrap tag-row">
          <span v-for="(t, i) in form.tags" :key="t + i" class="tag-chip">
            {{ t }}
            <button type="button" class="tag-x" @click="form.tags.splice(i, 1)"><Icon name="x" :size="11" /></button>
          </span>
        </div>
      </div>

      <div class="two-col">
        <div class="field">
          <span class="field-label">开始时间</span>
          <input type="date" class="input" :value="dateStr(form.startDate)" @change="form.startDate = $event.target.value ? parseDateStr($event.target.value) : null" />
        </div>
        <div class="field">
          <span class="field-label">完结时间</span>
          <input type="date" class="input" :value="dateStr(form.endDate)" @change="form.endDate = $event.target.value ? parseDateStr($event.target.value) : null" />
        </div>
      </div>

      <div class="field">
        <span class="field-label">一句话短评</span>
        <input v-model="form.oneLine" class="input" placeholder="一句话评价…" />
      </div>

      <div class="field">
        <span class="field-label">长篇观后感</span>
        <textarea v-model="form.review" class="input ta" rows="4" placeholder="感想、摘录、分析…" />
      </div>

      <div class="field">
        <span class="field-label">私密备忘录</span>
        <textarea v-model="form.memo" class="input ta" rows="2" placeholder="只有自己看的备忘…" />
      </div>

      <label class="row gap8 fav-line">
        <input v-model="form.favorite" type="checkbox" />
        <span>加入「{{ wishLabel(form.category) }}」收藏清单</span>
      </label>

      <div class="row gap8" style="justify-content: flex-end">
        <button type="button" class="btn btn-outline btn-sm" @click="$emit('close')">取消</button>
        <button type="button" class="btn btn-primary btn-sm" :disabled="!form.title.trim()" @click="save">保存</button>
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
import { MEDIA_CATS, MEDIA_STATUS_ORDER, statusLabel, wishLabel } from '../../mediaMeta.js'
import { fmtDate, parseDateStr } from '../../utils/date.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  item: { type: Object, default: null },
  defaultCategory: { type: String, default: 'book' },
})
const emit = defineEmits(['close', 'saved'])

const catOptions = MEDIA_CATS.map((c) => ({ label: c.label, value: c.key }))
const statusOptions = MEDIA_STATUS_ORDER.map((k) => ({ label: statusLabel(k), value: k }))

const CREATOR_LABEL = { book: '作者', movie: '导演 / 主创', series: '主创 / 演员', anime: '原作 / 主创', game: '开发商 / 制作组' }
const CREATOR_PH = { book: '如：余华', movie: '如：诺兰', series: '如：HBO', anime: '如：京阿尼', game: '如：任天堂' }
const TITLE_PH = { book: '书名', movie: '片名', series: '剧名', anime: '动画名', game: '游戏名' }
const creatorLabel = computed(() => CREATOR_LABEL[form.category] || '作者 / 主创')
const creatorPlaceholder = computed(() => CREATOR_PH[form.category] || '')
const titlePlaceholder = computed(() => TITLE_PH[form.category] || '名称')

const empty = () => ({
  category: props.defaultCategory,
  status: 'todo',
  title: '',
  creator: '',
  coverUrl: '',
  startDate: null,
  endDate: null,
  rating: 0,
  tags: [],
  oneLine: '',
  review: '',
  memo: '',
  favorite: false,
  totalPages: 0,
  currentPage: 0,
  totalEpisodes: 0,
  watchedEpisodes: 0,
  playHours: 0,
  levels: '',
})

const form = reactive(empty())
const tagInput = ref('')

function apply(m) {
  Object.assign(form, empty())
  if (!m) return
  form.category = m.category
  form.status = m.status
  form.title = m.title
  form.creator = m.creator || ''
  form.coverUrl = m.coverUrl || ''
  form.startDate = m.startDate
  form.endDate = m.endDate
  form.rating = m.rating || 0
  form.tags = [...(m.tags || [])]
  form.oneLine = m.oneLine || ''
  form.review = m.review || ''
  form.memo = m.memo || ''
  form.favorite = !!m.favorite
  form.totalPages = m.totalPages || 0
  form.currentPage = m.currentPage || 0
  form.totalEpisodes = m.totalEpisodes || 0
  form.watchedEpisodes = m.watchedEpisodes || 0
  form.playHours = m.playHours || 0
  form.levels = m.levels || ''
}

watch(
  () => [props.open, props.item],
  () => {
    if (!props.open) return
    apply(props.item)
    tagInput.value = ''
  },
  { immediate: true }
)

function dateStr(ts) {
  return ts == null ? '' : fmtDate(ts)
}
function addTag() {
  const t = tagInput.value.trim()
  if (!t) return
  if (!form.tags.includes(t)) form.tags.push(t)
  tagInput.value = ''
}

function save() {
  if (!form.title.trim()) return
  const payload = { ...form, title: form.title.trim(), tags: [...form.tags] }
  if (props.item) store.updateMedia(props.item.id, payload)
  else store.addMedia(payload)
  emit('saved')
  emit('close')
}
</script>

<style scoped>
.mf {
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

.stars {
  align-items: center;
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

.tag-row {
  margin-top: 2px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  padding: 2px 9px;
  border-radius: 999px;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 13%, transparent);
}

.tag-x {
  display: grid;
  place-items: center;
  color: inherit;
}

.fav-line {
  align-items: center;
  font-size: 13.5px;
}

.fav-line input {
  width: 15px;
  height: 15px;
  accent-color: var(--accent);
}
</style>
