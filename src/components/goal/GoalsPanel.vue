<template>
  <div class="goals-panel">
    <div class="toolbar card">
      <div class="row-between gap8 wrap">
        <button type="button" class="btn btn-outline btn-sm" @click="$emit('back')">
          <Icon name="chevronLeft" :size="14" /> 返回复盘
        </button>
        <SegControl :model-value="scope" :options="scopeOptions" @update:model-value="scope = $event" />
        <div class="row gap6 year-nav">
          <button type="button" class="nav-btn" @click="year -= 1"><Icon name="chevronLeft" :size="14" /></button>
          <strong class="year-text">{{ year }} 年</strong>
          <button type="button" class="nav-btn" @click="year += 1"><Icon name="chevronRight" :size="14" /></button>
          <button v-if="year !== thisYear" type="button" class="mini-btn" @click="year = thisYear">今年</button>
        </div>
      </div>
      <p class="muted mini panel-hint">
        {{ scope === 'month' ? '共 12 个月度卡片' : '共 4 个季度卡片' }} · 每个周期都有日历、目标清单与自由记录区；目标可被复盘引用（只读关联）。
      </p>
    </div>

    <div class="grid" :class="scope">
      <GoalPeriodCard
        v-for="i in cardCount"
        :key="scope + year + i"
        :ref="(el) => setCardRef(i - 1, el)"
        :year="year"
        :scope="scope"
        :index="i - 1"
        :current="isCurrent(i - 1)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import SegControl from '../ui/SegControl.vue'
import Icon from '../ui/Icon.vue'
import GoalPeriodCard from './GoalPeriodCard.vue'
import { GOAL_SCOPES } from '../../goalMeta.js'

defineEmits(['back'])

const thisYear = new Date().getFullYear()
const scope = ref('month')
const year = ref(thisYear)

const scopeOptions = GOAL_SCOPES.map((s) => ({ label: s.label, value: s.key }))

// 当前所处的月 / 季度
const now = new Date()
const currentMonthIdx = now.getMonth()
const currentQuarterIdx = Math.floor(now.getMonth() / 3)
const isCurrent = (index) => year.value === thisYear && index === (scope.value === 'month' ? currentMonthIdx : currentQuarterIdx)

// 进入板块或切换视图/年份时，直接定位到当前月 / 当前季度
const cardEls = ref([])
function setCardRef(i, el) {
  cardEls.value[i] = el
}
function locateCurrent() {
  if (year.value !== thisYear) return
  const idx = scope.value === 'month' ? currentMonthIdx : currentQuarterIdx
  const el = cardEls.value[idx] && cardEls.value[idx].$el ? cardEls.value[idx].$el : cardEls.value[idx]
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
}
onMounted(() => nextTick(locateCurrent))
watch([scope, year], () => nextTick(locateCurrent))
const cardCount = computed(() => (GOAL_SCOPES.find((s) => s.key === scope.value) || GOAL_SCOPES[0]).count)
</script>

<style scoped>
.goals-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.year-nav {
  align-items: center;
}

.year-text {
  font-size: 14px;
  min-width: 62px;
  text-align: center;
}

.nav-btn {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--text);
  display: grid;
  place-items: center;
}

.mini-btn {
  font-size: 11.5px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--muted);
}

.panel-hint {
  margin: 0;
}

.grid {
  display: grid;
  gap: 10px;
}

.grid.month {
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
}

.grid.quarter {
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
}
</style>
