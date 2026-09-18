import { reactive } from 'vue'

export const confirmState = reactive({
  visible: false,
  title: '请确认',
  message: '',
  detail: '',
  okText: '确定',
  danger: false,
  resolve: null,
})

export function askConfirm({ title = '请确认', message = '', detail = '', okText = '确定', danger = false } = {}) {
  return new Promise((resolve) => {
    confirmState.title = title
    confirmState.message = message
    confirmState.detail = detail
    confirmState.okText = okText
    confirmState.danger = danger
    confirmState.resolve = resolve
    confirmState.visible = true
  })
}

export function settleConfirm(ok) {
  confirmState.visible = false
  if (confirmState.resolve) {
    confirmState.resolve(ok)
    confirmState.resolve = null
  }
}

// 左侧滑出菜单（全局状态，任何页面都能呼出）
export const sideMenuState = reactive({ open: false })

export function openSideMenu() {
  sideMenuState.open = true
}

export function closeSideMenu() {
  sideMenuState.open = false
}

export const toastState = reactive({
  visible: false,
  message: '',
  kind: 'ok',
  timer: null,
})

export function showToast(message, kind = 'ok', ms = 1800) {
  toastState.message = message
  toastState.kind = kind
  toastState.visible = true
  clearTimeout(toastState.timer)
  toastState.timer = setTimeout(() => {
    toastState.visible = false
  }, ms)
}

export const MOTIVATIONS = ['太棒了！', '继续保持！', '优秀！', '自律就是自由', '又进一步！', '好习惯正在养成', '干得漂亮！', '坚持就是胜利']

export function randomMotivation() {
  return MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)]
}

// 在元素上触发一次“弹跳 + 彩色粒子”激励动画
export function fireConfetti(el) {
  if (!el) return
  el.classList.remove('pop-anim')
  void el.offsetWidth
  el.classList.add('pop-anim')
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const colors = ['var(--accent)', 'var(--primary-deep)', '#ff944d', '#eab308', 'var(--accent-deep)']
  for (let i = 0; i < 10; i += 1) {
    const s = document.createElement('span')
    s.className = 'particle'
    const a = Math.random() * Math.PI * 2
    const dist = 45 + Math.random() * 60
    s.style.setProperty('--dx', `${Math.cos(a) * dist}px`)
    s.style.setProperty('--dy', `${Math.sin(a) * dist}px`)
    s.style.left = `${cx}px`
    s.style.top = `${cy}px`
    s.style.background = colors[i % colors.length]
    document.body.appendChild(s)
    setTimeout(() => s.remove(), 750)
  }
}
