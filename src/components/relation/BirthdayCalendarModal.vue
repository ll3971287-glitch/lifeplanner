<template>
  <BaseModal :open="open" title="生日日历" @close="$emit('close')">
    <div class="bcal">
      <div class="row-between cal-head">
        <button type="button" class="nav-btn" @click="shiftMonth(-1)"><Icon name="chevronLeft" :size="15" /></button>
        <div class="row gap6 center-title">
          <strong>{{ cursor.y }} 年 {{ cursor.m + 1 }} 月</strong>
          <button type="button" class="mini-btn" @click="goNow">回到本月</button>
        </div>
        <button type="button" class="nav-btn" @click="shiftMonth(1)"><Icon name="chevronRight" :size="15" /></button>
      </div>

      <div class="grid">
        <span v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w" class="wh">{{ w }}</span>
        <button
          v-for="day in cells"
          :key="day"
          type="button"
          class="cell"
          :class="{ out: !inMonth(day), today: isToday(day), sel: selectedDay === day, has: bdOn(day).length }"
          @click="selectedDay = day"
        >
          <span class="num">{{ new Date(day).getDate() }}</span>
          <span class="names">
            <i v-for="p in bdOn(day).slice(0, 2)" :key="p.id" class="nm">{{ p.name }}</i>
            <i v-if="bdOn(day).length > 2" class="nm more">+{{ bdOn(day).length - 2 }}</i>
          </span>
        </button>
      </div>

      <div class="detail">
        <h4 class="detail-title">
          {{ selectedLabel }}
          <span class="muted mini" v-if="selectedList.length">· {{ selectedList.length }} 人生日</span>
        </h4>
        <div v-if="selectedList.length" class="detail-list">
          <div v-for="p in selectedList" :key="p.id" class="detail-row">
            <i class="g-dot" :style="{ background: genderColor(p.gender) }" />
            <span class="d-name">{{ p.name }}</span>
            <span v-if="p.birthYear" class="muted mini">{{ p.birthYear }} 年生</span>
            <span class="days" :class="{ now: daysOf(p) === 0 }">{{ countdownText(p) }}</span>
          </div>
        </div>
        <p v-else class="muted detail-empty">这一天没有人生日。</p>
      </div>
    </div>
  </BaseModal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import Icon from '../ui/Icon.vue'
import { store } from '../../store.js'
import { daysUntilBirthday, genderColor, isLeapYear } from '../../relationMeta.js'
import { monthGridTs, startOfDayTs, fmtDate } from '../../utils/date.js'

const props = defineProps({ open: { type: Boolean, default: false } })
defineEmits(['close'])

const now = new Date()
const cursor = ref({ y: now.getFullYear(), m: now.getMonth() })
const selectedDay = ref(startOfDayTs(Date.now()))

watch(
  () => props.open,
  (v) => {
    if (!v) return
    const d = new Date()
    cursor.value = { y: d.getFullYear(), m: d.getMonth() }
    selectedDay.value = startOfDayTs(Date.now())
  }
)

const cells = computed(() => monthGridTs(cursor.value.y, cursor.value.m))
const monthStart = computed(() => new Date(cursor.value.y, cursor.value.m, 1).getTime())
const monthEnd = computed(() => new Date(cursor.value.y, cursor.value.m + 1, 1).getTime())

function inMonth(day) {
  return day >= monthStart.value && day < monthEnd.value
}
function isToday(day) {
  return day === startOfDayTs(Date.now())
}

// 某天生日的人物（含平年 2/29 → 2/28）
function bdOn(dayTs) {
  if (!inMonth(dayTs)) return []
  const d = new Date(dayTs)
  const m = d.getMonth() + 1
  const day = d.getDate()
  return store.state.relations.filter((r) => {
    if (!r.birthMonth || !r.birthDay) return false
    if (r.birthMonth !== m) return false
    const eff = r.birthMonth === 2 && r.birthDay === 29 && !isLeapYear(d.getFullYear()) ? 28 : r.birthDay
    return eff === day
  })
}

const selectedList = computed(() => bdOn(selectedDay.value))
const selectedLabel = computed(() => `${fmtDate(selectedDay.value)} 星期${'日一二三四五六'[new Date(selectedDay.value).getDay()]}`)

function daysOf(p) {
  return daysUntilBirthday(p.birthMonth, p.birthDay, Date.now())
}
function countdownText(p) {
  const d = daysOf(p)
  if (d == null) return ''
  if (d === 0) return '就是今天 🎂'
  if (d === 1) return '明天生日 · 剩 1 天'
  return `距生日 ${d} 天`
}

function shiftMonth(n) {
  const m = cursor.value.m + n
  cursor.value = { y: cursor.value.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
}
function goNow() {
  const d = new Date()
  cursor.value = { y: d.getFullYear(), m: d.getMonth() }
  selectedDay.value = startOfDayTs(Date.now())
}
</script>

<style scoped>
.bcal {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cal-head {
  align-items: center;
}

.center-title {
  align-items: center;
  font-size: 14px;
}

.nav-btn {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--text);
  display: grid;
  place-items: center;
}

.mini-btn {
  font-size: 11.5px;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.wh {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  padding: 3px 0;
}

.cell {
  min-height: 52px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: color-mix(in srgb, var(--bg) 45%, transparent);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 3px 4px;
  text-align: left;
}

.cell.out {
  opacity: 0.4;
}

.cell.today .num {
  color: var(--accent-deep);
  font-weight: 900;
}

.cell.has {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
}

.cell.sel {
  border-color: var(--accent);
  border-width: 2px;
  padding: 2px 3px;
}

.num {
  font-size: 12px;
  font-weight: 700;
}

.names {
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: 100%;
}

.nm {
  font-size: 10px;
  font-style: normal;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-radius: 5px;
  padding: 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.nm.more {
  background: transparent;
  color: var(--muted);
}

.detail {
  border-top: 1px dashed var(--line);
  padding-top: 10px;
}

.detail-title {
  margin: 0 0 8px;
  font-size: 13.5px;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
}

.g-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.d-name {
  font-weight: 700;
}

.days {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}

.days.now {
  color: var(--warn);
  font-weight: 800;
}

.detail-empty {
  margin: 0;
  font-size: 13px;
}
</style>
