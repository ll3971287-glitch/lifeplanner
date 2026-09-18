<template>
  <nav ref="navRef" class="navbar" :class="{ sorting: reorder }">
    <template v-for="(key, idx) in orders" :key="key">
      <span v-if="reorder && dropIdx === idx" class="drop-slot" />
      <button
        type="button"
        class="nav-tab"
        :class="{ active: isActive(key), 'is-drag': reorder && draggingKey === key }"
        :style="tabStyle(key)"
        @pointerdown="onPointerDown(key, idx, $event)"
        @click="onClick(key)"
      >
        <span class="nav-icon">
          <Icon :name="iconOf(key)" :size="21" />
          <i v-if="reorder && draggingKey === key" class="grab-dot" />
        </span>
        <span class="nav-label">{{ labelOf(key) }}</span>
      </button>
    </template>
    <span v-if="reorder && dropIdx === orders.length" class="drop-slot" />
    <span v-if="reorder" class="sort-hint">松开落位 · 其它标签不移动</span>
  </nav>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store } from '../../store.js'
import Icon from '../ui/Icon.vue'

const route = useRoute()
const router = useRouter()

const TAB_META = {
  home: { label: '首页', icon: 'home', to: '/' },
  todos: { label: '待办', icon: 'todo', to: '/todos' },
  projects: { label: '项目', icon: 'briefcase', to: '/projects' },
  calendar: { label: '日历', icon: 'calendar', to: '/calendar' },
  checkins: { label: '打卡', icon: 'checkCircle', to: '/checkins' },
  media: { label: '书影音', icon: 'film', to: '/media' },
}
const DEFAULT_ORDER = ['home', 'todos', 'projects', 'calendar', 'checkins', 'media']

const navRef = ref(null)
const orders = ref([...DEFAULT_ORDER])

function syncOrder() {
  const saved = (store.state.settings.navOrder || []).filter((k) => TAB_META[k])
  orders.value = [...new Set([...saved, ...DEFAULT_ORDER])]
}
syncOrder()

const reorder = ref(false)
const draggingKey = ref(null)
const dragOffsetX = ref(0)
const dropIdx = ref(-1)

let downX = 0
let downIdx = -1
let timer = null
let ignoreClick = false

function iconOf(k) {
  return TAB_META[k] ? TAB_META[k].icon : 'more'
}
function labelOf(k) {
  return TAB_META[k] ? TAB_META[k].label : k
}
function isActive(k) {
  const to = TAB_META[k] ? TAB_META[k].to : '/'
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}

function tabStyle(key) {
  if (reorder.value && draggingKey.value === key) {
    return { transform: `translateX(${dragOffsetX.value}px)`, transition: 'none', zIndex: 3, position: 'relative' }
  }
  return undefined
}

function onPointerDown(key, idx, e) {
  if (!e.isPrimary && e.isPrimary !== undefined) return
  downX = e.clientX
  downIdx = idx
  draggingKey.value = key
  dragOffsetX.value = 0
  dropIdx.value = idx
  clearTimeout(timer)
  timer = setTimeout(() => {
    reorder.value = true
  }, 420)
}

function onPointerMove(e) {
  if (!reorder.value || draggingKey.value == null) return
  e.preventDefault()
  const unit = navRef.value && navRef.value.clientWidth ? navRef.value.clientWidth / orders.value.length : 90
  const delta = e.clientX - downX
  dragOffsetX.value = delta
  // 只移动被拖项；其它项原地不动，仅更新目标槽
  dropIdx.value = Math.max(0, Math.min(orders.value.length, downIdx + Math.round(delta / unit)))
}

function onPointerUp() {
  clearTimeout(timer)
  if (reorder.value) {
    reorder.value = false
    const key = draggingKey.value
    if (key) {
      const arr = orders.value.filter((k) => k !== key)
      arr.splice(Math.min(dropIdx.value, arr.length), 0, key)
      orders.value = arr
      store.setSetting('navOrder', arr)
    }
    ignoreClick = true
  }
  draggingKey.value = null
  dragOffsetX.value = 0
  dropIdx.value = -1
}

function onMoveHandler(e) {
  onPointerMove(e)
}
function onUpHandler() {
  onPointerUp()
}
function bindWindow() {
  window.addEventListener('pointermove', onMoveHandler, { passive: false })
  window.addEventListener('pointerup', onUpHandler)
  window.addEventListener('pointercancel', onUpHandler)
}
function unbindWindow() {
  window.removeEventListener('pointermove', onMoveHandler)
  window.removeEventListener('pointerup', onUpHandler)
  window.removeEventListener('pointercancel', onUpHandler)
}

function onClick(key) {
  if (ignoreClick) {
    ignoreClick = false
    return
  }
  const to = TAB_META[key] ? TAB_META[key].to : '/'
  router.push(to)
}

onMounted(bindWindow)
onBeforeUnmount(() => {
  clearTimeout(timer)
  unbindWindow()
})
</script>

<style scoped>
.navbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  height: var(--navbar-h);
  background: linear-gradient(0deg, color-mix(in srgb, var(--accent) 7%, var(--card)), color-mix(in srgb, var(--primary) 20%, var(--card)) 120%);
  border-top: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  display: flex;
  padding-bottom: env(safe-area-inset-bottom);
  touch-action: pan-y;
}

.navbar.sorting {
  background: color-mix(in srgb, var(--primary) 16%, var(--card));
}

.drop-slot {
  width: 3px;
  align-self: center;
  height: 46%;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--card) 70%, transparent);
  flex: none;
  animation: pulse-slot 0.9s ease infinite;
}

@keyframes pulse-slot {
  0%,
  100% {
    opacity: 0.9;
  }
  50% {
    opacity: 0.45;
  }
}

.nav-tab {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--text-dim);
  transition: color 0.15s ease, transform 0.18s ease;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  position: relative;
}

.nav-tab.active {
  color: var(--accent-deep);
}

.nav-tab.is-drag {
  color: var(--accent-deep);
  filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.25));
}

.nav-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 30px;
}

.nav-tab.active .nav-icon {
  border-radius: 12px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 24%, transparent), color-mix(in srgb, var(--primary-deep) 12%, transparent));
}

.grab-dot {
  position: absolute;
  top: -3px;
  right: -5px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 0.8s ease infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.6);
    opacity: 0.5;
  }
}

.nav-label {
  font-size: 11px;
  font-weight: 600;
}

.sort-hint {
  position: absolute;
  top: -26px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--text);
  color: #fff;
  font-size: 11.5px;
  padding: 4px 12px;
  border-radius: 999px;
  white-space: nowrap;
}
</style>
