<template>
  <Drawer :open="open" :title="item ? item.title : ''" @close="$emit('close')">
    <div v-if="item" class="md">
      <div class="md-top">
        <div class="md-cover" :style="{ background: catColor(item.category) }">
          <img v-if="item.coverUrl" :src="item.coverUrl" alt="" />
          <span v-else class="md-letter">{{ item.title.slice(0, 1) }}</span>
        </div>
        <div class="md-info">
          <div class="row gap6 wrap">
            <span class="cat-chip" :style="{ background: catColor(item.category) }">{{ catLabel(item.category) }}</span>
            <span class="stars">{{ stars }}</span>
          </div>
          <p v-if="item.creator" class="muted md-creator">{{ item.creator }}</p>
          <p class="muted mini">{{ dateRangeText }}</p>
        </div>
      </div>

      <!-- 状态切换 -->
      <div class="row gap6 wrap">
        <button
          v-for="k in MEDIA_STATUS_ORDER"
          :key="k"
          type="button"
          class="st-btn"
          :class="[statusMeta(k).cls, { on: item.status === k }]"
          @click="store.setMediaStatus(item.id, k)"
        >
          {{ statusLabel(k) }}
        </button>
      </div>

      <!-- 进度 -->
      <div class="block">
        <h4 class="block-title">进度</h4>
        <div v-if="prog.pct != null" class="prog-line">
          <ProgressBar :value="prog.pct" />
          <span class="muted mini">{{ prog.pct }}%</span>
        </div>
        <p v-if="prog.text" class="muted mini prog-text">{{ prog.text }}</p>

        <div v-if="item.category === 'book'" class="row gap6 wrap quick-row">
          <button type="button" class="btn btn-outline btn-sm" @click="bump('currentPage', 1)">+1 页</button>
          <button type="button" class="btn btn-outline btn-sm" @click="bump('currentPage', 10)">+10 页</button>
          <span class="muted mini">共 {{ item.totalPages || '未填' }} 页</span>
        </div>

        <div v-else-if="item.category === 'series' || item.category === 'anime'" class="row gap6 wrap quick-row">
          <button type="button" class="btn btn-outline btn-sm" @click="bump('watchedEpisodes', 1)">+1 集</button>
          <span class="muted mini">共 {{ item.totalEpisodes || '未填' }} 集</span>
        </div>

        <div v-else-if="item.category === 'game'" class="row gap6 wrap quick-row">
          <button type="button" class="btn btn-outline btn-sm" @click="bumpHours(-0.5)">-0.5 小时</button>
          <button type="button" class="btn btn-outline btn-sm" @click="bumpHours(0.5)">+0.5 小时</button>
        </div>
      </div>

      <!-- 剧集/动漫：单集随笔 -->
      <div v-if="item.category === 'series' || item.category === 'anime'" class="block">
        <h4 class="block-title">单集随笔（{{ (item.episodeNotes || []).length }}）</h4>
        <div class="note-list">
          <div v-for="(n, i) in item.episodeNotes || []" :key="i" class="note-row">
            <span class="ep-tag">第 {{ n.ep }} 集</span>
            <input
              class="note-input"
              :value="n.note"
              placeholder="这一集的随笔…"
              @change="updateNote(i, $event.target.value)"
            />
            <button type="button" class="mini del" title="删除" @click="removeNote(i)"><Icon name="x" :size="12" /></button>
          </div>
        </div>
        <div class="row gap6 add-note">
          <input v-model.number="newEp" type="number" min="1" class="ep-input" placeholder="集" />
          <input v-model="newNote" class="note-input" placeholder="写下这一集的随笔…" @keyup.enter="addNote" />
          <button type="button" class="btn btn-outline btn-sm" @click="addNote">添加</button>
        </div>
      </div>

      <!-- 游戏：关卡 / 成就 -->
      <template v-if="item.category === 'game'">
        <div class="block">
          <h4 class="block-title">关卡记录</h4>
          <textarea
            class="edit-area"
            rows="3"
            :value="item.levels"
            placeholder="如：序章、第二关、Boss 战…（逗号或换行分隔）"
            @change="store.updateMedia(item.id, { levels: $event.target.value })"
          />
        </div>
        <div class="block">
          <h4 class="block-title">成就（{{ (item.achievements || []).length }}）</h4>
          <div class="row gap6">
            <input v-model="newAch" class="ach-input" placeholder="新增成就…" @keyup.enter="addAch" />
            <button type="button" class="btn btn-outline btn-sm" @click="addAch">添加</button>
          </div>
          <ul v-if="(item.achievements || []).length" class="ach-list">
            <li v-for="(a, i) in item.achievements" :key="a + i">
              <Icon name="check" :size="12" />
              <span class="ach-text">{{ a }}</span>
              <button type="button" class="mini del" @click="removeAch(i)"><Icon name="x" :size="12" /></button>
            </li>
          </ul>
        </div>
      </template>

      <!-- 短评 / 长评 / 备忘录 -->
      <div class="block">
        <h4 class="block-title">一句话短评</h4>
        <input
          class="edit-input"
          :value="item.oneLine"
          placeholder="一句话评价…"
          @change="store.updateMedia(item.id, { oneLine: $event.target.value })"
        />
      </div>

      <div class="block">
        <h4 class="block-title">长篇观后感</h4>
        <textarea
          v-model="reviewBuf"
          class="edit-area"
          rows="5"
          placeholder="感想、摘录、分析…（自动保存）"
          @input="saveReview"
        />
      </div>

      <div class="block">
        <h4 class="block-title">私密备忘录</h4>
        <textarea
          v-model="memoBuf"
          class="edit-area"
          rows="3"
          placeholder="只有自己看的备忘…（自动保存）"
          @input="saveMemo"
        />
      </div>

      <div class="row gap6 wrap md-actions">
        <button type="button" class="btn btn-outline btn-sm" @click="store.toggleFavorite(item.id)">
          <Icon name="check" :size="13" /> {{ item.favorite ? `移出「${wishLabel(item.category)}」` : `加入「${wishLabel(item.category)}」` }}
        </button>
        <button type="button" class="btn btn-outline btn-sm" @click="$emit('edit', item)">编辑</button>
        <button type="button" class="btn btn-danger btn-sm" @click="remove">删除</button>
      </div>
    </div>
  </Drawer>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import Drawer from '../ui/Drawer.vue'
import Icon from '../ui/Icon.vue'
import ProgressBar from '../ui/ProgressBar.vue'
import { store } from '../../store.js'
import { catColor, catLabel, MEDIA_STATUS_ORDER, statusLabel, statusMeta, progressInfo, ratingStars, wishLabel } from '../../mediaMeta.js'
import { fmtDate } from '../../utils/date.js'
import { askConfirm, showToast } from '../../ui.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  itemId: { type: String, default: null },
})
const emit = defineEmits(['close', 'edit'])

const item = computed(() => store.state.mediaItems.find((m) => m.id === props.itemId) || null)
const stars = computed(() => ratingStars(item.value && item.value.rating))
const prog = computed(() => progressInfo(item.value))
const dateRangeText = computed(() => {
  if (!item.value) return ''
  const s = item.value.startDate
  const e = item.value.endDate
  if (s && e) return `${fmtDate(s)} ~ ${fmtDate(e)}`
  if (s) return `${fmtDate(s)} 开始`
  if (e) return `${fmtDate(e)} 完结`
  return '未记录时间'
})

// 就地编辑用的临时状态（需在 watch 之前声明）
const newEp = ref(null)
const newNote = ref('')
const newAch = ref('')
const reviewBuf = ref('')
const memoBuf = ref('')
watch(
  () => [props.itemId, props.open],
  () => {
    reviewBuf.value = item.value ? item.value.review || '' : ''
    memoBuf.value = item.value ? item.value.memo || '' : ''
    newEp.value = null
    newNote.value = ''
    newAch.value = ''
  },
  { immediate: true }
)

let reviewTimer = null
let memoTimer = null
function saveReview() {
  clearTimeout(reviewTimer)
  reviewTimer = setTimeout(() => {
    if (item.value) store.updateMedia(item.value.id, { review: reviewBuf.value })
  }, 500)
}
function saveMemo() {
  clearTimeout(memoTimer)
  memoTimer = setTimeout(() => {
    if (item.value) store.updateMedia(item.value.id, { memo: memoBuf.value })
  }, 500)
}
onBeforeUnmount(() => {
  clearTimeout(reviewTimer)
  clearTimeout(memoTimer)
})

function bump(field, step) {
  if (!item.value) return
  const total = field === 'currentPage' ? Number(item.value.totalPages) || 0 : Number(item.value.totalEpisodes) || 0
  let v = (Number(item.value[field]) || 0) + step
  v = Math.max(0, v)
  if (total) v = Math.min(total, v)
  store.updateMedia(item.value.id, { [field]: v })
}
function bumpHours(delta) {
  if (!item.value) return
  const v = Math.max(0, Math.round(((Number(item.value.playHours) || 0) + delta) * 10) / 10)
  store.updateMedia(item.value.id, { playHours: v })
}

// 单集随笔
function addNote() {
  if (!item.value) return
  const ep = Number(newEp.value) || (item.value.episodeNotes || []).length + 1
  const note = newNote.value.trim()
  if (!note) return
  const list = [...(item.value.episodeNotes || []), { ep, note }].sort((a, b) => a.ep - b.ep)
  store.updateMedia(item.value.id, { episodeNotes: list })
  newEp.value = null
  newNote.value = ''
}
function updateNote(i, text) {
  if (!item.value) return
  const list = [...(item.value.episodeNotes || [])]
  list[i] = { ...list[i], note: text }
  store.updateMedia(item.value.id, { episodeNotes: list })
}
function removeNote(i) {
  if (!item.value) return
  const list = (item.value.episodeNotes || []).filter((_, idx) => idx !== i)
  store.updateMedia(item.value.id, { episodeNotes: list })
}

// 成就
function addAch() {
  if (!item.value) return
  const a = newAch.value.trim()
  if (!a) return
  store.updateMedia(item.value.id, { achievements: [...(item.value.achievements || []), a] })
  newAch.value = ''
}
function removeAch(i) {
  if (!item.value) return
  store.updateMedia(item.value.id, { achievements: (item.value.achievements || []).filter((_, idx) => idx !== i) })
}

async function remove() {
  const ok = await askConfirm({ title: '删除记录', message: `删除「${item.value.title}」的记录？`, danger: true, okText: '删除' })
  if (!ok) return
  store.deleteMedia(item.value.id)
  showToast('已删除')
  emit('close')
}
</script>

<style scoped>
.md {
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.md-top {
  display: flex;
  gap: 12px;
}

.md-cover {
  width: 74px;
  height: 98px;
  border-radius: 10px;
  overflow: hidden;
  display: grid;
  place-items: center;
  flex: none;
}

.md-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.md-letter {
  font-size: 26px;
  font-weight: 800;
  color: #fff;
}

.md-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cat-chip {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  border-radius: 999px;
  padding: 1px 9px;
}

.stars {
  font-size: 14px;
  color: var(--warn);
  letter-spacing: 1px;
}

.md-creator {
  margin: 0;
  font-size: 12.5px;
}

/* 状态按钮 */
.st-btn {
  font-size: 12.5px;
  font-weight: 700;
  padding: 6px 13px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--muted);
}

.st-btn.todo.on {
  background: color-mix(in srgb, var(--line) 80%, transparent);
  color: var(--text);
}

.st-btn.doing.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent-deep);
}

.st-btn.done.on {
  border-color: var(--success);
  background: color-mix(in srgb, var(--success) 16%, transparent);
  color: var(--success);
}

.st-btn.paused.on {
  border-color: var(--warn);
  background: color-mix(in srgb, var(--warn) 16%, transparent);
  color: var(--warn);
}

.block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.block-title {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.prog-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.prog-line :deep(.progress-bar),
.prog-line :deep(.bar) {
  flex: 1;
}

.prog-text {
  margin: 0;
}

.quick-row {
  align-items: center;
}

.note-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.note-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ep-tag {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  border-radius: 999px;
  padding: 1px 8px;
  flex: none;
}

.note-input,
.ep-input,
.ach-input,
.edit-input {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--panel);
  font-size: 12.5px;
}

.ep-input {
  flex: none;
  width: 58px;
}

.add-note {
  align-items: center;
}

.edit-area {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
}

.ach-list {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ach-list li {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--success);
}

.ach-text {
  flex: 1;
  color: var(--text);
}

.mini.del {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  color: var(--muted);
  display: grid;
  place-items: center;
  flex: none;
}

.mini.del:hover {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

.md-actions {
  align-items: center;
  padding-bottom: 12px;
}
</style>
