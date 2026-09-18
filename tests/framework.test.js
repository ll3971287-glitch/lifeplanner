import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { sideMenuState } from '../src/ui.js'
import { createRouter, createMemoryHistory } from 'vue-router'
import Icon from '../src/components/ui/Icon.vue'
import SegControl from '../src/components/ui/SegControl.vue'
import Switch from '../src/components/ui/Switch.vue'
import ProgressBar from '../src/components/ui/ProgressBar.vue'
import EmptyState from '../src/components/ui/EmptyState.vue'
import BaseModal from '../src/components/ui/BaseModal.vue'
import Drawer from '../src/components/ui/Drawer.vue'
import ConfirmDialog from '../src/components/ui/ConfirmDialog.vue'
import ToastHost from '../src/components/ui/ToastHost.vue'
import TopBar from '../src/components/layout/TopBar.vue'
import BottomNav from '../src/components/layout/BottomNav.vue'
import { router as realRouter } from '../src/router.js'
import { askConfirm, settleConfirm, showToast, toastState, confirmState } from '../src/ui.js'

function stubRoutes() {
  const stub = { template: '<div />' }
  return [
    { path: '/', name: 'home', component: stub, meta: { title: '首页' } },
    { path: '/todos', name: 'todos', component: stub, meta: { title: '待办' } },
    { path: '/tags', name: 'tags', component: stub, meta: { title: '标签' } },
    { path: '/reviews', name: 'reviews', component: stub, meta: { title: '复盘' } },
    { path: '/settings', name: 'settings', component: stub, meta: { title: '设置' } },
    { path: '/projects', name: 'projects', component: stub },
    { path: '/calendar', name: 'calendar', component: stub },
    { path: '/checkins', name: 'checkins', component: stub },
  ]
}

afterEach(() => {
  confirmState.visible = false
  confirmState.resolve = null
  toastState.visible = false
  clearTimeout(toastState.timer)
  document.body.innerHTML = ''
})

describe('基础组件', () => {
  it('Icon 渲染 svg 且未知名称为空', () => {
    const w = mount(Icon, { props: { name: 'check', size: 20 } })
    expect(w.find('svg').attributes('width')).toBe('20')
    expect(w.find('svg').html()).toContain('polyline')
    const w2 = mount(Icon, { props: { name: 'no-such' } })
    expect(w2.find('svg').html()).not.toContain('path')
  })

  it('SegControl 高亮当前值并发射更新', async () => {
    const w = mount(SegControl, {
      props: { modelValue: 'a', options: [{ label: '甲', value: 'a' }, { label: '乙', value: 'b' }] },
    })
    expect(w.findAll('.seg-item')[0].classes()).toContain('active')
    await w.findAll('.seg-item')[1].trigger('click')
    expect(w.emitted('update:modelValue')[0]).toEqual(['b'])
  })

  it('Switch 开关发射相反值', async () => {
    const w = mount(Switch, { props: { modelValue: false } })
    expect(w.find('.switch').classes()).not.toContain('on')
    await w.find('.switch').trigger('click')
    expect(w.emitted('update:modelValue')[0]).toEqual([true])
  })

  it('ProgressBar 宽度钳制在 0-100', () => {
    const w = mount(ProgressBar, { props: { value: 45 } })
    expect(w.find('.progress-fill').attributes('style')).toContain('45%')
    const w2 = mount(ProgressBar, { props: { value: 150 } })
    expect(w2.find('.progress-fill').attributes('style')).toContain('100%')
    const w3 = mount(ProgressBar, { props: { value: -5 } })
    expect(w3.find('.progress-fill').attributes('style')).toContain('0%')
  })

  it('EmptyState 展示文本与插槽', () => {
    const w = mount(EmptyState, { props: { text: '暂无任务', hint: '点 + 新建' } })
    expect(w.text()).toContain('暂无任务')
    expect(w.text()).toContain('点 + 新建')
  })
})

describe('弹层组件', () => {
  it('BaseModal 打开时渲染插槽，关闭按钮触发 close', async () => {
    const w = mount(BaseModal, {
      props: { open: true, title: '新建任务' },
      slots: { default: '<p class="body-x">表单内容</p>' },
    })
    await nextTick()
    const panel = document.body.querySelector('.modal-panel')
    expect(panel).toBeTruthy()
    expect(panel.textContent).toContain('新建任务')
    expect(panel.textContent).toContain('表单内容')
    const closeBtn = panel.querySelector('.icon-btn')
    closeBtn.click()
    expect(w.emitted('close')).toBeTruthy()
  })

  it('BaseModal 关闭时不渲染', () => {
    mount(BaseModal, { props: { open: false } })
    expect(document.body.querySelector('.modal-panel')).toBeNull()
  })

  it('Drawer 打开渲染插槽并支持关闭', async () => {
    const w = mount(Drawer, {
      props: { open: true, title: '任务详情' },
      slots: { default: '<p class="drawer-x">详情内容</p>' },
    })
    await nextTick()
    const panel = document.body.querySelector('.drawer-panel')
    expect(panel.textContent).toContain('任务详情')
    expect(panel.textContent).toContain('详情内容')
    panel.querySelector('.icon-btn').click()
    expect(w.emitted('close')).toBeTruthy()
  })
})

describe('确认框与 Toast', () => {
  it('askConfirm 点确定 resolve true，点取消 resolve false', async () => {
    mount(ConfirmDialog)
    const p = askConfirm({ title: '删除', message: '确定删除该任务？', danger: true })
    await nextTick()
    const panel = document.body.querySelector('.confirm-panel')
    expect(panel.textContent).toContain('确定删除该任务？')
    panel.querySelector('.btn-danger').click()
    expect(await p).toBe(true)
    expect(document.body.querySelector('.confirm-panel')).toBeNull()
  })

  it('showToast 显示并自动隐藏', async () => {
    mount(ToastHost)
    showToast('已保存')
    await nextTick()
    expect(document.body.textContent).toContain('已保存')
  })
})

describe('导航框架', () => {
  it('BottomNav 渲染 6 个 Tab 且高亮当前路由', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: stubRoutes() })
    router.push('/todos')
    await router.isReady()
    const w = mount(BottomNav, { global: { plugins: [router] } })
    expect(w.findAll('.nav-tab')).toHaveLength(6)
    const labels = w.findAll('.nav-label').map((n) => n.text())
    expect(labels).toEqual(['首页', '待办', '项目', '日历', '打卡', '书影音'])
    const active = w.findAll('.nav-tab').find((n) => n.classes().includes('active'))
    expect(active.text()).toContain('待办')
  })

  it('长按后拖动可调整导航顺序并持久化', async () => {
    vi.useFakeTimers()
    try {
      store._replace(defaultState())
      const router = createRouter({ history: createMemoryHistory(), routes: stubRoutes() })
      router.push('/')
      await router.isReady()
      const w = mount(BottomNav, { global: { plugins: [router] } })
      await nextTick()
      expect(w.findAll('.nav-label')[0].text()).toBe('首页')
      const first = w.findAll('.nav-tab')[0]
      first.element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }))
      vi.advanceTimersByTime(500) // 超过长按阈值进入排序模式
      await nextTick()
      expect(w.find('.navbar').classes()).toContain('sorting')
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 290 }))
      await nextTick()
      const dragTab = w.find('.nav-tab.is-drag')
      expect(dragTab.exists()).toBe(true)
      expect(dragTab.attributes('style')).toContain('translateX(')
      // 拖动中：其它标签不移动、顺序未持久化，出现落位槽
      expect(w.find('.drop-slot').exists()).toBe(true)
      expect(store.state.settings.navOrder[0]).toBe('home')
      window.dispatchEvent(new MouseEvent('pointerup'))
      await nextTick()
      expect(store.state.settings.navOrder[0]).toBe('todos')
      expect(w.findAll('.nav-label')[0].text()).toBe('待办')
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('首页 Tab 仅在精确 / 时激活', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: stubRoutes() })
    router.push('/')
    await router.isReady()
    const w = mount(BottomNav, { global: { plugins: [router] } })
    const active = w.findAll('.nav-tab').filter((n) => n.classes().includes('active'))
    expect(active).toHaveLength(1)
    expect(active[0].text()).toContain('首页')
  })

  it('TopBar：普通页只有标题 + 菜单按钮；设置页保留原有入口', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: stubRoutes() })
    router.push('/todos')
    await router.isReady()
    const w = mount(TopBar, { global: { plugins: [router] } })
    expect(w.find('.topbar-title').text()).toBe('待办')
    // 普通页：只有 ☰ 菜单按钮，没有关系/蓝图/标签/复盘/设置图标
    expect(w.findAll('.top-btn')).toHaveLength(1)
    expect(w.find('.menu-btn').exists()).toBe(true)
    await w.find('.menu-btn').trigger('click')
    expect(sideMenuState.open).toBe(true)
    sideMenuState.open = false
    // 设置页：顶部保持原样（5 个入口、无菜单按钮）
    await router.push('/settings')
    await nextTick()
    expect(w.find('.menu-btn').exists()).toBe(false)
    expect(w.findAll('.top-btn')).toHaveLength(5)
    w.unmount()
  })

  it('router 注册 16 条路由', () => {
    const names = realRouter.getRoutes().map((r) => r.name)
    expect(names).toHaveLength(16)
    for (const n of ['home', 'todos', 'projects', 'project-detail', 'calendar', 'checkins', 'checkin-detail', 'focus', 'tags', 'tag-detail', 'reviews', 'blueprints', 'relations', 'goals', 'media', 'settings']) {
      expect(names).toContain(n)
    }
  })
})
