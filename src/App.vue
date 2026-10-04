<template>
  <div class="app-shell">
    <TopBar />
    <main class="page-wrap">
      <RouterView />
    </main>
    <BottomNav />
    <SideMenu />
    <ConfirmDialog />
    <ToastHost />
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { store } from './store.js'
import TopBar from './components/layout/TopBar.vue'
import BottomNav from './components/layout/BottomNav.vue'
import SideMenu from './components/layout/SideMenu.vue'
import ConfirmDialog from './components/ui/ConfirmDialog.vue'
import ToastHost from './components/ui/ToastHost.vue'
import { sideMenuState, openSideMenu } from './ui.js'

onMounted(async () => {
  // 手势监听不依赖数据初始化，先挂上
  window.addEventListener('pointerdown', onEdgeDown, { capture: true, passive: true })
  window.addEventListener('pointermove', onEdgeMove, { passive: true })
  window.addEventListener('pointerup', onEdgeUp, { passive: true })
  document.addEventListener('click', onDateInputClick)
  await store.init()
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onEdgeDown, { capture: true })
  window.removeEventListener('pointermove', onEdgeMove)
  window.removeEventListener('pointerup', onEdgeUp)
  document.removeEventListener('click', onDateInputClick)
})

// 日期/时间输入兜底：若点击后未拿到焦点（安卓等环境下会被父层吞掉），
// 主动聚焦并请求弹出原生选择器
const DATE_INPUT_TYPES = ['date', 'time', 'datetime-local', 'month', 'week']

function onDateInputClick(e) {
  const el = e.target
  if (!el || el.tagName !== 'INPUT') return
  if (!DATE_INPUT_TYPES.includes(el.type)) return
  if (el.disabled || el.readOnly) return
  if (document.activeElement === el) return // 已正常聚焦，系统会自行弹出选择器
  try {
    el.focus()
    if (typeof el.showPicker === 'function') el.showPicker()
  } catch (err) {
    /* 不支持 showPicker 的环境：仅完成聚焦 */
  }
}

// 屏幕左边缘向右滑动呼出侧栏
const EDGE = 26
let edgeStartX = null
let edgeStartY = 0
function onEdgeDown(e) {
  if (sideMenuState.open) return
  if (e.clientX > EDGE) return
  edgeStartX = e.clientX
  edgeStartY = e.clientY
}
function onEdgeMove(e) {
  if (edgeStartX == null) return
  const dx = e.clientX - edgeStartX
  const dy = Math.abs(e.clientY - edgeStartY)
  if (dx > 45 && dy < 70) {
    openSideMenu()
    edgeStartX = null
  }
}
function onEdgeUp() {
  edgeStartX = null
}
</script>
