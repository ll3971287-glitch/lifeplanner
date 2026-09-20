<template>
  <Teleport to="body">
    <Transition name="fade-bg">
      <div v-if="sideMenuState.open" class="sm-mask" @click.self="closeSideMenu">
        <Transition name="slide-left" appear>
          <aside
            class="sm-panel"
            role="dialog"
            aria-label="功能菜单"
            @pointerdown="onPanelDown"
            @pointermove="onPanelMove"
            @pointerup="onPanelUp"
            @pointercancel="onPanelUp"
          >
            <div class="sm-head">
              <span class="sm-brand">
                <i class="brand-bar" />
                Ultimate Life System
              </span>
              <button type="button" class="sm-close" aria-label="收起菜单" @click="closeSideMenu">
                <Icon name="chevronLeft" :size="17" />
              </button>
            </div>
            <p class="muted sm-hint">向左滑或点空白处收起</p>

            <nav class="sm-nav">
              <template v-for="group in groups" :key="group.label">
                <h4 class="sm-group">{{ group.label }}</h4>
                <button
                  v-for="item in group.items"
                  :key="item.label"
                  type="button"
                  class="sm-item"
                  :class="{ on: item.to && isActive(item.to), soon: item.soon }"
                  @click="go(item)"
                >
                  <span class="sm-icon"><Icon :name="item.icon" :size="16" /></span>
                  <span class="sm-label">{{ item.label }}</span>
                  <span v-if="item.soon" class="soon-tag">即将上线</span>
                  <Icon v-else name="chevronRight" :size="15" class="sm-arrow" />
                </button>
              </template>
            </nav>

            <div class="sm-foot">
              <button type="button" class="sm-item" :class="{ on: isActive('/settings') }" @click="go({ label: '设置', to: '/settings', icon: 'settings' })">
                <span class="sm-icon"><Icon name="settings" :size="16" /></span>
                <span class="sm-label">设置</span>
                <Icon name="chevronRight" :size="15" class="sm-arrow" />
              </button>
            </div>
          </aside>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import Icon from '../ui/Icon.vue'
import { sideMenuState, closeSideMenu, showToast } from '../../ui.js'

const route = useRoute()
const router = useRouter()

const groups = [
  {
    label: '规划',
    items: [
      { label: '未来蓝图', to: '/blueprints', icon: 'flag' },
      { label: '人情', to: '/relations', icon: 'heart' },
      { label: '书影音', to: '/media', icon: 'film' },
    ],
  },
  {
    label: '生活',
    items: [{ label: '食物储存', to: '/food', icon: 'box' }],
  },
  {
    label: '回顾',
    items: [
      { label: '目标', to: '/goals', icon: 'pin' },
      { label: '复盘', to: '/reviews', icon: 'refresh' },
      { label: '标签', to: '/tags', icon: 'tag' },
    ],
  },
]

function isActive(to) {
  return route.path === to || route.path.startsWith(to + '/')
}

function go(item) {
  if (item.soon) {
    showToast('书影音模块即将上线')
    return
  }
  closeSideMenu()
  if (item.to) router.push(item.to)
}

// 面板上向左滑（或右滑）收起
const drag = { x: null, moved: 0 }
function onPanelDown(e) {
  drag.x = e.clientX
  drag.moved = 0
}
function onPanelMove(e) {
  if (drag.x == null) return
  drag.moved = e.clientX - drag.x
  if (Math.abs(drag.moved) > 60) {
    closeSideMenu()
    drag.x = null
  }
}
function onPanelUp() {
  drag.x = null
}
</script>

<style scoped>
.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.22s ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-102%);
}

.sm-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  z-index: 130;
}

.sm-panel {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: min(78vw, 300px);
  display: flex;
  flex-direction: column;
  background: var(--card);
  color: var(--text);
  border-right: 1px solid var(--line);
  box-shadow: var(--shadow-lg);
  padding: 16px 12px 12px;
  touch-action: pan-y;
}

.sm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.sm-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 800;
}

.brand-bar {
  width: 8px;
  height: 18px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--accent), var(--primary-deep));
}

.sm-close {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  color: var(--text-dim);
  display: grid;
  place-items: center;
}

.sm-close:hover {
  background: color-mix(in srgb, var(--line) 60%, transparent);
}

.sm-hint {
  margin: 2px 4px 10px;
  font-size: 11.5px;
}

.sm-nav {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sm-group {
  margin: 12px 6px 4px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0.04em;
}

.sm-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 10px;
  border-radius: 12px;
  text-align: left;
  color: var(--text);
  font-size: 14.5px;
}

.sm-item:hover {
  background: color-mix(in srgb, var(--line) 55%, transparent);
}

.sm-item.on {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent-deep);
  font-weight: 700;
}

.sm-item.soon {
  opacity: 0.72;
}

.sm-icon {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--line) 45%, transparent);
  color: var(--text-dim);
  flex: none;
}

.sm-item.on .sm-icon {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  color: var(--accent-deep);
}

.sm-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.soon-tag {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--muted);
  border: 1px dashed var(--line);
  border-radius: 999px;
  padding: 1px 8px;
  flex: none;
}

.sm-arrow {
  color: var(--text-dim);
  flex: none;
}

.sm-foot {
  border-top: 1px solid var(--line);
  padding-top: 8px;
  margin-top: 8px;
}
</style>
