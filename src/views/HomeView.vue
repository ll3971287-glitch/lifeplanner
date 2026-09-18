<template>
  <div class="home">
    <header class="hello">
      <h1 class="greet">{{ greetText }}</h1>
      <p class="muted date-line">{{ fullDateText }}</p>
    </header>

    <div ref="homeGridRef" class="home-grid">
      <!-- 今日待办 -->
      <section class="card h-card" :style="cardStyle('todayTodos')">
        <div class="h-head">
          <div class="row gap4 head-left">
            <button type="button" class="drag-handle" aria-label="拖动调整顺序" @pointerdown.stop="dragStart('todayTodos', $event)">
              <Icon name="grip" :size="14" />
            </button>
            <h2 class="h-title"><Icon name="todo" :size="16" /> 今日计划</h2>
          </div>
          <button type="button" class="more-btn muted" @click="router.push('/todos')">全部 ›</button>
        </div>
        <div class="span-bar">
          <SegControl :model-value="dueSpan" :options="spanOptions" @update:model-value="dueSpan = $event" />
        </div>
        <div v-if="todayList.length" class="h-list">
          <div v-for="row in todayList" :key="row.key" class="h-row">
            <button
              type="button"
              class="check"
              :class="{ on: row.done }"
              @click="toggleRow(row)"
            >
              <Icon v-if="row.done" name="check" :size="12" />
            </button>
            <div class="h-row-main" @click="gotoRow(row)">
              <span class="h-row-title" :class="{ done: row.done }">{{ row.title }}</span>
              <span class="row gap6 wrap row-meta">
                <span v-if="row.timeText" class="time-mini muted">{{ row.timeText }}</span>
                <span v-if="row.projectName" class="proj-tag">{{ row.projectName }}</span>
                <TagChips v-if="row.tagIds && row.tagIds.length" :tag-ids="row.tagIds" />
              </span>
            </div>
            <button
              type="button"
              class="focus-mini"
              title="开始专注"
              @click.stop="store.openFocus({ mode: 'pomodoro', targetType: 'todo', targetId: row.id })"
            >
              <Icon name="clock" :size="14" />
            </button>
          </div>
        </div>
        <p v-else class="muted empty-tip">今天没有待办，享受轻松的一天。</p>
      </section>

      <!-- 未来蓝图：进行中 + 临近期望 -->
      <section v-if="homeBlueprints.length" class="card h-card" :style="cardStyle('blueprints')">
        <div class="h-head">
          <div class="row gap4 head-left">
            <button type="button" class="drag-handle" aria-label="拖动调整顺序" @pointerdown.stop="dragStart('blueprints', $event)">
              <Icon name="grip" :size="14" />
            </button>
            <h2 class="h-title"><Icon name="flag" :size="15" /> 未来蓝图 <span v-if="bpSoonCount" class="soon-badge">近 {{ bpSoonCount }} 个临期</span></h2>
          </div>
          <button type="button" class="more-btn muted" @click="router.push('/blueprints')">全部 ›</button>
        </div>
        <div class="h-list">
          <button v-for="b in homeBlueprints" :key="b.id" type="button" class="h-row bp-home-row" @click="openBlueprint(b.id)">
            <i class="bp-dot" :style="{ background: bpDimColor(b) }" />
            <span class="h-row-title">{{ b.title }}</span>
            <span v-if="goalEndOf(b)" class="time-mini muted">
              {{ goalEndOf(b) >= Date.now() ? '剩 ' + daysLeft(goalEndOf(b)) + ' 天' : '超期望 ' + daysLeft(goalEndOf(b)) + ' 天' }}
            </span>
            <span v-else-if="b.goalText" class="time-mini muted">{{ b.goalText }}</span>
            <span class="st-pill" :class="b.status">{{ bpStatusLabel(b.status) }}</span>
          </button>
        </div>
      </section>

      <!-- 近期生日 -->
      <section v-if="upcomingBirthdays.length" class="card h-card" :style="cardStyle('relations')">
        <div class="h-head">
          <div class="row gap4 head-left">
            <button type="button" class="drag-handle" aria-label="拖动调整顺序" @pointerdown.stop="dragStart('relations', $event)">
              <Icon name="grip" :size="14" />
            </button>
            <h2 class="h-title"><Icon name="heart" :size="15" /> 近期生日</h2>
          </div>
          <button type="button" class="more-btn muted" @click="router.push('/relations')">全部 ›</button>
        </div>
        <div class="h-list">
          <button v-for="it in upcomingBirthdays" :key="it.id" type="button" class="h-row bp-home-row" @click="router.push('/relations')">
            <i class="bp-dot" :style="{ background: it.color }" />
            <span class="h-row-title">{{ it.name }}</span>
            <span class="time-mini muted">{{ it.text }}</span>
          </button>
        </div>
      </section>

      <!-- 最近在看（书影音） -->
      <section v-if="recentMediaList.length" class="card h-card" :style="cardStyle('media')">
        <div class="h-head">
          <div class="row gap4 head-left">
            <button type="button" class="drag-handle" aria-label="拖动调整顺序" @pointerdown.stop="dragStart('media', $event)">
              <Icon name="grip" :size="14" />
            </button>
            <h2 class="h-title"><Icon name="film" :size="15" /> 最近在看</h2>
          </div>
          <button type="button" class="more-btn muted" @click="router.push('/media')">全部 ›</button>
        </div>
        <div class="h-list">
          <button v-for="m in recentMediaList" :key="m.id" type="button" class="h-row bp-home-row" @click="openMedia(m.id)">
            <i class="bp-dot" :style="{ background: mediaCatColor(m.category) }" />
            <span class="h-row-title">{{ m.title }}</span>
            <span v-if="m.creator" class="time-mini muted">{{ m.creator }}</span>
            <span v-if="mediaProgText(m)" class="time-mini muted">{{ mediaProgText(m) }}</span>
            <span class="st-pill" :class="m.status">{{ mediaStatusLabel(m.status) }}</span>
          </button>
        </div>
      </section>

      <!-- 项目进度 -->
      <section v-if="showProjectsOnHome" class="card h-card" :style="cardStyle('projects')">
        <div class="h-head">
          <div class="row gap4 head-left">
            <button type="button" class="drag-handle" aria-label="拖动调整顺序" @pointerdown.stop="dragStart('projects', $event)">
              <Icon name="grip" :size="14" />
            </button>
            <h2 class="h-title"><Icon name="briefcase" :size="16" /> 项目进度</h2>
          </div>
          <div class="row gap4">
            <button type="button" class="more-btn muted" title="不在首页显示（可在设置中恢复）" @click="hideProjects">隐藏</button>
            <button type="button" class="more-btn muted" @click="router.push('/projects')">全部 ›</button>
          </div>
        </div>
        <div v-if="projList.length" class="proj-list">
          <button v-for="p in projList" :key="p.id" type="button" class="proj-row" @click="router.push(`/projects/${p.id}`)">
            <div class="row-between">
              <span class="proj-name">{{ p.name }}</span>
              <span class="muted proj-dead" :class="{ late: isOverdue(p) }">{{ deadlineText(p.deadline) }}</span>
            </div>
            <div class="row gap8">
              <ProgressBar :value="statsOf(p).pct" />
              <span class="pct">{{ statsOf(p).pct }}%</span>
            </div>
          </button>
        </div>
        <p v-else-if="!store.state.projects.length" class="muted empty-tip">还没有项目，去建一个吧。</p>
        <p v-else class="muted empty-tip">全部项目已完成。</p>
      </section>

      <!-- 专注 -->
      <section class="card h-card" :style="cardStyle('focus')">
        <div class="h-head">
          <div class="row gap4 head-left">
            <button type="button" class="drag-handle" aria-label="拖动调整顺序" @pointerdown.stop="dragStart('focus', $event)">
              <Icon name="grip" :size="14" />
            </button>
            <h2 class="h-title"><Icon name="clock" :size="16" /> 今日专注</h2>
          </div>
          <button type="button" class="more-btn muted" @click="router.push('/focus')">专注页 ›</button>
        </div>
        <div class="focus-body">
          <div class="focus-stats">
            <span class="big-num">{{ fmtFocusMinute(focusStats.minutes) }}</span>
            <span class="muted">{{ focusStats.count }} 次 · 目标 {{ store.state.settings.dailyFocusGoalMin }} 分钟</span>
          </div>
          <button
            v-if="running"
            type="button"
            class="btn btn-lg btn-accent resume-btn"
            @click="store.openFocus({})"
          >
            <Icon name="play" :size="17" /> 回到专注（进行中）
          </button>
          <button v-else type="button" class="btn btn-lg btn-accent resume-btn" @click="store.openFocus({})">
            <Icon name="play" :size="17" /> 开始专注
          </button>
        </div>
      </section>

      <!-- 打卡 -->
      <section class="card h-card" :style="cardStyle('checkins')">
        <div class="h-head">
          <div class="row gap4 head-left">
            <button type="button" class="drag-handle" aria-label="拖动调整顺序" @pointerdown.stop="dragStart('checkins', $event)">
              <Icon name="grip" :size="14" />
            </button>
            <h2 class="h-title"><Icon name="checkCircle" :size="16" /> 今日打卡</h2>
          </div>
          <button type="button" class="more-btn muted" @click="router.push('/checkins')">全部 ›</button>
        </div>
        <div v-if="checkinList.length" class="h-list">
          <div v-for="it in checkinList" :key="it.checkin.id" class="h-row">
            <div class="h-row-main" @click="router.push(`/checkins/${it.checkin.id}`)">
              <span class="h-row-title" :class="{ met: it.met }">{{ it.checkin.name }}</span>
              <span class="time-mini muted" :class="{ met: it.met }">
                {{ checkinTodayProgressText(it.checkin, it.stat) }}{{ it.met ? ' · 已达标' : '' }}
              </span>
            </div>
            <button type="button" class="checkin-mini" :class="{ met: it.met }" :disabled="!it.active" @click.stop="quickCheckin(it, $event.currentTarget)">
              <Icon name="plus" :size="13" />
            </button>
          </div>
        </div>
        <p v-else class="muted empty-tip">还没有打卡项目。</p>
      </section>

      <!-- 即将到期 -->
      <section class="card h-card" :style="cardStyle('dueSoon')">
        <div class="h-head">
          <div class="row gap4 head-left">
            <button type="button" class="drag-handle" aria-label="拖动调整顺序" @pointerdown.stop="dragStart('dueSoon', $event)">
              <Icon name="grip" :size="14" />
            </button>
            <h2 class="h-title"><Icon name="alert" :size="16" /> 即将到期</h2>
          </div>
        </div>
        <div v-if="dueSoon.length" class="h-list">
          <button v-for="it in dueSoon" :key="it.kind + it.id" type="button" class="due-row" @click="gotoDue(it)">
            <span class="due-tag" :class="it.kind">{{ it.kind === 'todo' ? '任务' : '项目' }}</span>
            <span class="due-name">{{ it.title }}</span>
            <span class="muted due-time">{{ fmtTime(it.at) }}</span>
          </button>
        </div>
        <p v-else class="muted empty-tip">未来 48 小时没有到期安排。</p>
      </section>

      <!-- 复盘入口 -->
      <section class="card h-card" :style="cardStyle('reviews')">
        <div class="h-head">
          <div class="row gap4 head-left">
            <button type="button" class="drag-handle" aria-label="拖动调整顺序" @pointerdown.stop="dragStart('reviews', $event)">
              <Icon name="grip" :size="14" />
            </button>
            <h2 class="h-title"><Icon name="refresh" :size="16" /> 复盘</h2>
          </div>
          <button type="button" class="more-btn muted" @click="router.push('/reviews')">去复盘 ›</button>
        </div>
        <p v-if="!todayReviewDone" class="hint-line warn-line">今天还没写日复盘，花两分钟回顾一下。</p>
        <p v-else class="hint-line">今天的日复盘已完成。</p>
        <div class="row gap6 link-row">
          <button type="button" class="btn btn-sm btn-outline" @click="router.push('/tags')">
            <Icon name="tag" :size="13" /> 标签
          </button>
          <button type="button" class="btn btn-sm btn-outline" @click="router.push('/reviews')">
            <Icon name="book" :size="13" /> 历史复盘
          </button>
        </div>
      </section>
    </div>

    <CheckinRecordModal :open="recordOpen" :checkin-id="recordCheckinId" @close="recordOpen = false" @recorded="onRecorded" />
    <BlueprintDrawer :open="bpDrawerOpen" :bp-id="bpActiveId" @close="bpDrawerOpen = false" />
    <MediaDrawer :open="mediaDrawer.open" :item-id="mediaDrawer.id" @close="mediaDrawer.open = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../store.js'
import {
  todoActiveOnDay,
  todoActiveInRange,
  activeProjects,
  projectStats,
  projectOverdue,
  todayFocusStats,
  checkinTodayList,
  checkinTodayProgressText,
  dueSoonItems,
  recentMedia,
  reviewsFor,
} from '../selectors.js'
import { BLUEPRINT_STATUS, dimColor } from '../blueprintMeta.js'
import { daysUntilBirthday, genderColor } from '../relationMeta.js'
import { catColor as mediaCatColor, statusLabel as mediaStatusLabel, progressInfo as mediaProgressInfo } from '../mediaMeta.js'
import MediaDrawer from '../components/media/MediaDrawer.vue'
import { startOfDayTs, startOfWeekTs, fmtTime, DAY_MS } from '../utils/date.js'
import { fmtFullDate, todoTimeText, fmtFocusMinute, deadlineText } from '../format.js'
import Icon from '../components/ui/Icon.vue'
import SegControl from '../components/ui/SegControl.vue'
import ProgressBar from '../components/ui/ProgressBar.vue'
import TagChips from '../components/ui/TagChips.vue'
import CheckinRecordModal from '../components/checkin/CheckinRecordModal.vue'
import BlueprintDrawer from '../components/blueprint/BlueprintDrawer.vue'
import { showToast, randomMotivation, fireConfetti } from '../ui.js'

const router = useRouter()
const nowTs = ref(Date.now())
const recordOpen = ref(false)
const recordCheckinId = ref(null)

const timer = setInterval(() => {
  nowTs.value = Date.now()
}, 60000)

const DEFAULT_CARD_ORDER = ['todayTodos', 'blueprints', 'relations', 'projects', 'focus', 'checkins', 'media', 'dueSoon', 'reviews']
const homeGridRef = ref(null)
const cardOrder = ref([...DEFAULT_CARD_ORDER])

function syncCardOrder() {
  const saved = (store.state.settings.homeOrder || []).filter((k) => DEFAULT_CARD_ORDER.includes(k))
  cardOrder.value = [...new Set([...saved, ...DEFAULT_CARD_ORDER])]
}
syncCardOrder()

function cardStyle(key) {
  const s = { order: cardOrder.value.indexOf(key) }
  if (draggingKey.value === key) {
    s.transform = `translateY(${dragY.value}px)`
    s.transition = 'none'
    s.zIndex = 3
    s.position = 'relative'
  }
  // 落位槽提示：目标位置前一张卡底部亮色指示（其它卡不移动）
  if (cardDragging && draggingKey.value !== key && hintKey.value === key) {
    s.boxShadow = 'inset 0 -6px 0 var(--accent)'
  }
  return s
}

let cardTimer = null
let cardDragging = false
let cardDownIdx = -1
let cardFinal = -1
let downY = 0
const draggingKey = ref(null)
const dragY = ref(0)
const hintKey = ref(null)

function dragStart(key, e) {
  downY = e.clientY
  cardDownIdx = cardOrder.value.indexOf(key)
  cardFinal = cardDownIdx
  draggingKey.value = key
  dragY.value = 0
  clearTimeout(cardTimer)
  cardTimer = setTimeout(() => {
    cardDragging = true
  }, 420)
}

function onCardMove(e) {
  if (!cardDragging || draggingKey.value == null) return
  e.preventDefault()
  const grid = homeGridRef.value
  const unit = grid && grid.clientHeight ? grid.clientHeight / cardOrder.value.length : 180
  const delta = e.clientY - downY
  dragY.value = delta
  // 只移动被拖卡片，其它卡片原地不动；仅更新落位目标
  cardFinal = Math.max(0, Math.min(cardOrder.value.length, cardDownIdx + Math.round(delta / unit)))
  const before = cardFinal - 1
  hintKey.value = before >= 0 ? cardOrder.value[before] : null
}

function onCardUp() {
  clearTimeout(cardTimer)
  if (cardDragging) {
    cardDragging = false
    const key = draggingKey.value
    if (key) {
      const arr = cardOrder.value.filter((k) => k !== key)
      arr.splice(Math.min(cardFinal, arr.length), 0, key)
      cardOrder.value = arr
      store.setSetting('homeOrder', arr)
    }
  }
  draggingKey.value = null
  dragY.value = 0
  hintKey.value = null
  cardDownIdx = -1
  cardFinal = -1
}

onMounted(() => {
  window.addEventListener('pointermove', onCardMove, { passive: false })
  window.addEventListener('pointerup', onCardUp)
  window.addEventListener('pointercancel', onCardUp)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  clearTimeout(cardTimer)
  window.removeEventListener('pointermove', onCardMove)
  window.removeEventListener('pointerup', onCardUp)
  window.removeEventListener('pointercancel', onCardUp)
})

const greetText = computed(() => {
  const h = new Date(nowTs.value).getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const fullDateText = computed(() => fmtFullDate(nowTs.value))

const dueSpan = ref('day')
const spanOptions = [
  { label: '今天', value: 'day' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
]

const dueRange = computed(() => {
  const now = nowTs.value
  if (dueSpan.value === 'day') {
    const d = startOfDayTs(now)
    return [d, d + DAY_MS]
  }
  if (dueSpan.value === 'week') {
    const s = startOfWeekTs(now)
    return [s, s + 7 * DAY_MS]
  }
  const d = new Date(now)
  const s = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
  return [s, e]
})

const todayList = computed(() => {
  const [rs, re] = dueRange.value
  const rows = []
  const isDay = dueSpan.value === 'day'
  const hitTodo = (t) => (isDay ? todoActiveOnDay(t, rs) : todoActiveInRange(t, rs, re))
  for (const t of store.state.todos) {
    if (t.parentId || t.completed || !hitTodo(t)) continue
    const proj = t.projectId ? store.state.projects.find((x) => x.id === t.projectId) : null
    rows.push({
      key: 'todo' + t.id,
      kind: 'todo',
      id: t.id,
      projectId: t.projectId || null,
      projectName: proj ? proj.name : '',
      tagIds: t.tagIds || [],
      title: t.title,
      done: t.completed,
      timeText: todoTimeText(t),
      completedAt: t.completedAt,
    })
  }
  return rows.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (b.completedAt || 0) - (a.completedAt || 0))
})

function toggleRow(row) {
  store.toggleTodo(row.id)
}

function gotoRow(row) {
  if (row.projectId) {
    router.push(`/projects/${row.projectId}`)
  } else {
    router.push('/todos')
  }
}

const projList = computed(() => activeProjects(store.state).slice(0, 3))

function statsOf(p) {
  return projectStats(store.state, p.id)
}

function isOverdue(p) {
  return projectOverdue(p, nowTs.value)
}

const showProjectsOnHome = computed(() => store.state.settings.showProjectsOnHome !== false)

function hideProjects() {
  store.setSetting('showProjectsOnHome', false)
  showToast('项目进度已隐藏，可在 设置 → 首页内容 中恢复')
}

const focusStats = computed(() => todayFocusStats(store.state.sessions, nowTs.value))
const running = computed(() => store.focusState.phase === 'run' || store.focusState.phase === 'pause')

const checkinList = computed(() => checkinTodayList(store.state, nowTs.value).filter((i) => i.active))

let lastBtn = null

function quickCheckin(it, btn) {
  const c = it.checkin
  if (c.fixedDurationMin || c.rule === 'count') {
    lastBtn = btn || null
    recordCheckinId.value = c.id
    recordOpen.value = true
  } else {
    store.addCheckinRecord(c.id, { count: 1 })
    showToast(`${randomMotivation()} 已打卡 1 ${c.unit}`)
    fireConfetti(btn)
  }
}

function onRecorded() {
  fireConfetti(lastBtn)
  showToast(randomMotivation())
}

const dueSoon = computed(() => dueSoonItems(store.state, nowTs.value, 48 * 3600000))

// 未来蓝图板块：进行中 + 期望日临期（90 天内）的蓝图
const bpDrawerOpen = ref(false)
const bpActiveId = ref(null)
const BP_SOON_MS = 7 * DAY_MS
function goalEndOf(b) {
  return b.goalEndTs != null ? b.goalEndTs : b.goalDateTs != null ? b.goalDateTs : null
}
const homeBlueprints = computed(() => {
  const now = nowTs.value
  const near = (b) => {
    const e = goalEndOf(b)
    return e != null && e >= now && e - now <= 90 * DAY_MS
  }
  return store.state.blueprints
    .filter((b) => b.status === 'doing' || (b.status === 'idea' && near(b)))
    .slice(0, 6)
})
const bpSoonCount = computed(() => {
  const now = nowTs.value
  return store.state.blueprints.filter((b) => b.status === 'doing' && goalEndOf(b) != null && goalEndOf(b) - now <= BP_SOON_MS && goalEndOf(b) >= now).length
})
const bpStatusLabel = (k) => ({ idea: '构想中', doing: '进行中', paused: '已搁置', done: '已完成' }[k] || k)
const bpDimColor = (b) => (b.dimension ? dimColor(b.dimension, store.state.settings.blueprintDims) : '#9ca3af')
function daysLeft(ts) {
  return Math.max(1, Math.round((ts - nowTs.value) / DAY_MS))
}
function openBlueprint(id) {
  bpActiveId.value = id
  bpDrawerOpen.value = true
}

// 首页「最近在看」：进行中的书影音（没有则最近更新的）
const mediaDrawer = ref({ open: false, id: null })
const recentMediaList = computed(() => recentMedia(store.state, 5))
function mediaProgText(m) {
  const p = mediaProgressInfo(m)
  return p.text
}
function openMedia(id) {
  mediaDrawer.value = { open: true, id }
}

// 首页近期生日：30 天内（含今天）
const upcomingBirthdays = computed(() => {
  const out = store.state.relations
    .map((r) => ({ r, d: daysUntilBirthday(r.birthMonth, r.birthDay, nowTs.value) }))
    .filter((x) => x.d != null && x.d <= 30)
    .sort((a, b) => a.d - b.d)
    .slice(0, 6)
  return out.map((x) => ({
    id: x.r.id,
    name: x.r.name,
    color: genderColor(x.r.gender),
    text: x.d === 0 ? '今天生日 🎂' : x.d === 1 ? '明天生日' : `还有 ${x.d} 天`,
  }))
})

function gotoDue(it) {
  router.push(it.kind === 'todo' ? '/todos' : `/projects/${it.id}`)
}

const todayReviewDone = computed(() => reviewsFor(store.state, 'day').some((r) => r.periodDate === startOfDayTs(nowTs.value)))
</script>

<style scoped>
.bp-home-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 9px 2px;
}

.bp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.soon-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--warn);
  background: color-mix(in srgb, var(--warn) 13%, transparent);
  padding: 1px 8px;
  border-radius: 999px;
  margin-left: 2px;
}

.st-pill {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 999px;
  margin-left: auto;
}

.st-pill.doing {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.st-pill.idea,
.st-pill.todo {
  color: var(--text-dim);
  background: var(--line);
}

.st-pill.done {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 15%, transparent);
}

.st-pill.paused {
  color: var(--warn);
  background: color-mix(in srgb, var(--warn) 14%, transparent);
}
.home {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.hello {
  padding: 4px 2px;
}

.greet {
  margin: 0;
  font-size: 24px;
}

.date-line {
  margin: 2px 0 0;
}

.home-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 12px;
  align-items: start;
}

.h-card {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 0.18s ease;
}

.h-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.head-left {
  min-width: 0;
}

.drag-handle {
  color: var(--text-dim);
  opacity: 0.55;
  width: 22px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  touch-action: none;
}

.drag-handle:active {
  opacity: 1;
  color: var(--accent-deep);
}

.h-title {
  margin: 0;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--accent-deep);
}

.more-btn {
  background: none;
  font-size: 12.5px;
}

.span-bar {
  display: flex;
  justify-content: flex-start;
}

.h-list {
  display: flex;
  flex-direction: column;
}

.h-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--line);
}

.h-row:last-child {
  border-bottom: none;
}

.check {
  width: 21px;
  height: 21px;
  border-radius: 50%;
  border: 2px solid var(--line);
  background: var(--card);
  color: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.check.on {
  background: var(--primary-deep);
  border-color: var(--primary-deep);
  color: #fff;
}

.h-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  cursor: pointer;
}

.h-row-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14.5px;
}

.h-row-title.done {
  color: var(--text-dim);
  text-decoration: line-through;
}

.h-row-title.met {
  color: var(--success);
}

.time-mini {
  font-size: 11.5px;
}

.time-mini.met {
  color: var(--success);
  font-weight: 700;
}

.proj-tag {
  display: inline-block;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-radius: 999px;
  padding: 0 8px;
  align-self: flex-start;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-mini {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.empty-tip {
  margin: 2px 0 6px;
  font-size: 13px;
}

.proj-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.proj-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  padding: 6px 0;
  border-bottom: 1px dashed var(--line);
}

.proj-row:last-child {
  border-bottom: none;
}

.proj-name {
  font-weight: 700;
  font-size: 14.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proj-dead.late {
  color: var(--danger);
  font-weight: 700;
}

.pct {
  font-size: 13px;
  font-weight: 800;
  color: var(--primary-deep);
}

.focus-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.focus-stats {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.big-num {
  font-size: 38px;
  font-weight: 800;
  color: var(--accent-deep);
}

.resume-btn {
  border-radius: 999px;
}

.checkin-mini {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--primary-deep);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.checkin-mini.met {
  background: color-mix(in srgb, var(--success) 16%, transparent);
  color: var(--success);
}

.checkin-mini:disabled {
  opacity: 0.4;
}

.due-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--line);
  width: 100%;
  text-align: left;
}

.due-tag {
  font-size: 10.5px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 5px;
  flex: none;
}

.due-tag.todo {
  background: color-mix(in srgb, var(--primary) 45%, transparent);
  color: var(--primary-deep);
}

.due-tag.project {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent-deep);
}

.due-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.due-time {
  flex: none;
}

.hint-line {
  margin: 0;
  font-size: 13.5px;
}

.warn-line {
  color: var(--warn);
  font-weight: 600;
}

.link-row {
  flex-wrap: wrap;
}
</style>
