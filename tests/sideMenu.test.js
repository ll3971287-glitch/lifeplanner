import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { sideMenuState, openSideMenu, closeSideMenu, toastState } from '../src/ui.js'
import SideMenu from '../src/components/layout/SideMenu.vue'
import App from '../src/App.vue'

beforeEach(() => {
  store._replace(defaultState())
  sideMenuState.open = false
  toastState.visible = false
})

afterEach(() => {
  document.body.innerHTML = ''
})

async function mountMenu(path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/todos', name: 'todos', component: { template: '<div/>' } },
      { path: '/blueprints', name: 'blueprints', component: { template: '<div/>' } },
      { path: '/relations', name: 'relations', component: { template: '<div/>' } },
      { path: '/reviews', name: 'reviews', component: { template: '<div/>' } },
      { path: '/tags', name: 'tags', component: { template: '<div/>' } },
      { path: '/settings', name: 'settings', component: { template: '<div/>' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  openSideMenu()
  const w = mount(SideMenu, { global: { plugins: [router] } })
  return { w, router }
}

const itemByText = (text) => [...document.querySelectorAll('.sm-item')].find((b) => b.textContent.includes(text))

describe('左侧滑出菜单', () => {
  it('按分组渲染全部入口（规划 / 回顾 / 设置）', async () => {
    const { w } = await mountMenu()
    await nextTick()
    expect(document.body.textContent).toContain('规划')
    expect(document.body.textContent).toContain('回顾')
    for (const label of ['未来蓝图', '人情', '书影音', '复盘', '标签', '设置']) {
      expect(itemByText(label), label).toBeTruthy()
    }
    // 书影音标记为即将上线
    expect(itemByText('书影音').textContent).toContain('即将上线')
    w.unmount()
  })

  it('点击条目跳转并自动收起菜单', async () => {
    const { w, router } = await mountMenu()
    await nextTick()
    itemByText('未来蓝图').click()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/blueprints')
    expect(sideMenuState.open).toBe(false)
    w.unmount()
  })

  it('书影音点击只提示、不跳转也不关闭', async () => {
    const { w, router } = await mountMenu('/todos')
    await nextTick()
    itemByText('书影音').click()
    await nextTick()
    expect(router.currentRoute.value.path).toBe('/todos')
    expect(sideMenuState.open).toBe(true)
    expect(toastState.message).toContain('书影音')
    w.unmount()
  })

  it('当前页面对应条目高亮', async () => {
    const { w } = await mountMenu('/relations')
    await nextTick()
    expect(itemByText('人情').classList.contains('on')).toBe(true)
    expect(itemByText('复盘').classList.contains('on')).toBe(false)
    w.unmount()
  })

  it('点击遮罩空白处关闭；面板左滑超过阈值收起', async () => {
    const { w } = await mountMenu()
    await nextTick()
    // 点遮罩
    document.querySelector('.sm-mask').click()
    await nextTick()
    expect(sideMenuState.open).toBe(false)
    // 左滑收起
    openSideMenu()
    await nextTick()
    const panel = document.querySelector('.sm-panel')
    panel.dispatchEvent(new MouseEvent('pointerdown', { clientX: 200, bubbles: true }))
    panel.dispatchEvent(new MouseEvent('pointermove', { clientX: 100, bubbles: true }))
    await nextTick()
    expect(sideMenuState.open).toBe(false)
    w.unmount()
    closeSideMenu()
  })
})

describe('左边缘手势呼出', () => {
  it('从屏幕左边缘向右滑动可打开菜单', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'home', component: { template: '<div/>' } }, { path: '/todos', name: 'todos', component: { template: '<div/>' } }],
    })
    router.push('/')
    const w = mount(App, { global: { plugins: [router], stubs: { RouterView: true } } })
    await nextTick()
    expect(sideMenuState.open).toBe(false)
    window.dispatchEvent(new MouseEvent('pointerdown', { clientX: 8, clientY: 300 }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 80, clientY: 305 }))
    await nextTick()
    expect(sideMenuState.open).toBe(true)
    w.unmount()
  })
})
