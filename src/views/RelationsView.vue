<template>
  <div class="rel-view">
    <!-- 顶部迷你月历 -->
    <div class="card mini-card" @click="calOpen = true">
      <div class="row-between mini-head">
        <h2 class="mini-title"><Icon name="heart" :size="15" /> {{ nowY }} 年 {{ nowM + 1 }} 月 · 生日</h2>
        <span class="muted mini">点击查看完整日历 ›</span>
      </div>
      <div class="mini-grid">
        <span v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w" class="mwh">{{ w }}</span>
        <div
          v-for="day in miniCells"
          :key="day"
          class="mcell"
          :class="{ out: !inThisMonth(day), today: day === todayTs, has: bdCount(day) }"
        >
          <span class="mnum">{{ new Date(day).getDate() }}</span>
          <i v-if="bdCount(day)" class="m-dot" />
        </div>
      </div>
    </div>

    <div class="toolbar card">
      <div class="row-between gap8 wrap">
        <SegControl :model-value="sortMode" :options="sortOptions" @update:model-value="sortMode = $event" />
        <button type="button" class="btn btn-primary btn-sm" @click="openCreate">
          <Icon name="plus" :size="14" /> 新增人物
        </button>
      </div>
      <p class="muted mini count-line">{{ relations.length }} 位 · 当月生日 {{ monthBdCount }} 人</p>
    </div>

    <!-- 列表 -->
    <div v-if="sorted.length" class="list">
      <div v-for="r in sorted" :key="r.id" class="card row-item">
        <span class="avatar" :style="{ background: genderColor(r.gender) }">{{ r.name.slice(0, 1) }}</span>
        <div class="row-main">
          <div class="row gap6 name-line">
            <span class="r-name">{{ r.name }}</span>
            <span class="g-chip" :style="{ background: genderColor(r.gender) }">{{ genderLabel(r.gender) }}</span>
            <span v-if="ageText(r)" class="muted mini">{{ ageText(r) }}</span>
          </div>
          <div class="row gap6 wrap meta-line">
            <span v-if="r.birthMonth" class="meta birth">
              <Icon name="calendar" :size="11" /> {{ birthdayText(r) }}
              <b :class="{ hot: daysOf(r) <= 7 }">{{ countdownText(r) }}</b>
            </span>
            <span v-if="r.place" class="meta"><Icon name="pin" :size="11" /> {{ r.place }}</span>
          </div>
          <div class="stars-line">
            <span v-for="i in 5" :key="i" class="s" :class="{ on: i <= (r.affinity || 0) }">★</span>
          </div>
          <p v-if="r.note" class="note">{{ r.note }}</p>
        </div>
        <div class="ops">
          <button type="button" class="mini op" title="编辑" @click="openEdit(r)">
            <Icon name="edit" :size="14" />
          </button>
          <button type="button" class="mini op danger" title="删除" @click="remove(r)">
            <Icon name="trash" :size="14" />
          </button>
        </div>
      </div>
    </div>
    <EmptyState v-else icon="heart" text="还没有关系条目" hint="记录重要的人：关系、生日、常见地点、好感度与喜好备注">
      <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="openCreate">
        <Icon name="plus" :size="15" /> 添加第一位
      </button>
    </EmptyState>

    <RelationFormModal :open="form.open" :relation="form.relation" @close="form.open = false" />
    <BirthdayCalendarModal :open="calOpen" @close="calOpen = false" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store } from '../store.js'
import {
  daysUntilBirthday,
  compareByBirthday,
  genderColor,
  genderLabel,
  birthdayText,
  ageOf,
  isLeapYear,
} from '../relationMeta.js'
import { monthGridTs, startOfDayTs } from '../utils/date.js'
import { askConfirm, showToast } from '../ui.js'
import Icon from '../components/ui/Icon.vue'
import SegControl from '../components/ui/SegControl.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import RelationFormModal from '../components/relation/RelationFormModal.vue'
import BirthdayCalendarModal from '../components/relation/BirthdayCalendarModal.vue'

const now = new Date()
const nowY = now.getFullYear()
const nowM = now.getMonth()
const todayTs = startOfDayTs(Date.now())

const sortOptions = [
  { label: '生日临近', value: 'birthday' },
  { label: '好感度', value: 'affinity' },
  { label: '姓名', value: 'name' },
]
const sortMode = ref('birthday')
const relations = computed(() => store.state.relations)

const sorted = computed(() => {
  const list = [...relations.value]
  if (sortMode.value === 'birthday') return list.sort((a, b) => compareByBirthday(a, b))
  if (sortMode.value === 'affinity') return list.sort((a, b) => (b.affinity || 0) - (a.affinity || 0) || (a.name || '').localeCompare(b.name || ''))
  return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
})

// 迷你月历
const miniCells = computed(() => monthGridTs(nowY, nowM))
const monthStart = new Date(nowY, nowM, 1).getTime()
const monthEnd = new Date(nowY, nowM + 1, 1).getTime()
function inThisMonth(day) {
  return day >= monthStart && day < monthEnd
}
function bdCount(day) {
  return relations.value.filter((r) => onDay(r, day)).length
}
function onDay(r, dayTs) {
  if (!r.birthMonth || !r.birthDay) return false
  const d = new Date(dayTs)
  if (r.birthMonth !== d.getMonth() + 1) return false
  const eff = r.birthMonth === 2 && r.birthDay === 29 && !isLeapYear(d.getFullYear()) ? 28 : r.birthDay
  return eff === d.getDate()
}
const monthBdCount = computed(() => relations.value.filter((r) => r.birthMonth === nowM + 1).length)

function ageText(r) {
  const age = r.age != null ? r.age : ageOf(r.birthYear, r.birthMonth, r.birthDay)
  return age != null ? `${age} 岁` : ''
}
function daysOf(r) {
  return daysUntilBirthday(r.birthMonth, r.birthDay)
}
function countdownText(r) {
  const d = daysOf(r)
  if (d == null) return ''
  if (d === 0) return '今天生日 🎂'
  if (d === 1) return '明天生日'
  return `还有 ${d} 天`
}

// 表单
const form = ref({ open: false, relation: null })
function openCreate() {
  form.value = { open: true, relation: null }
}
function openEdit(r) {
  form.value = { open: true, relation: r }
}

const calOpen = ref(false)

async function remove(r) {
  const ok = await askConfirm({ title: '删除人物', message: `删除「${r.name}」的关系记录？`, danger: true, okText: '删除' })
  if (!ok) return
  store.deleteRelation(r.id)
  showToast('已删除')
}
</script>

<style scoped>
.rel-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mini-card {
  padding: 12px 14px;
  cursor: pointer;
}

.mini-head {
  align-items: center;
  margin-bottom: 8px;
}

.mini-title {
  margin: 0;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.mini-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
}

.mwh {
  text-align: center;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--muted);
}

.mcell {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg) 45%, transparent);
  display: grid;
  place-items: center;
  font-size: 11.5px;
}

.mcell.out {
  opacity: 0.35;
}

.mcell.today {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  font-weight: 800;
}

.mcell.has {
  background: color-mix(in srgb, var(--warn) 16%, transparent);
}

.m-dot {
  position: absolute;
  bottom: 3px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--warn);
}

.toolbar {
  padding: 12px 14px;
}

.count-line {
  margin: 8px 0 0;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row-item {
  display: flex;
  gap: 10px;
  padding: 12px;
  align-items: flex-start;
}

.avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  color: #fff;
  font-weight: 800;
  font-size: 16px;
  display: grid;
  place-items: center;
  flex: none;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name-line {
  align-items: center;
}

.r-name {
  font-size: 15px;
  font-weight: 800;
}

.g-chip {
  font-size: 10.5px;
  font-weight: 700;
  color: #fff;
  border-radius: 999px;
  padding: 1px 7px;
}

.meta-line {
  font-size: 12px;
}

.meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
}

.meta.birth b {
  color: var(--muted);
  font-weight: 700;
}

.meta.birth b.hot {
  color: var(--warn);
}

.stars-line {
  display: flex;
  gap: 2px;
}

.s {
  font-size: 13px;
  color: var(--line);
}

.s.on {
  color: var(--warn);
}

.note {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ops {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.op {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  color: var(--muted);
  display: grid;
  place-items: center;
}

.op:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.op.danger:hover {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}
</style>
