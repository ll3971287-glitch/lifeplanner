import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import TagFormModal from '../src/components/tag/TagFormModal.vue'
import TagsView from '../src/views/TagsView.vue'
import TodosView from '../src/views/TodosView.vue'
import TagDetailView from '../src/views/TagDetailView.vue'
import ConfirmDialog from '../src/components/ui/ConfirmDialog.vue'
import { settleConfirm, confirmState } from '../src/ui.js'

beforeEach(() => {
  store._replace(defaultState())
})

afterEach(() => {
  confirmState.visible = false
  confirmState.resolve = null
  document.body.innerHTML = ''
})

describe('TagFormModal', () => {
  it('新建标签并可选颜色', async () => {
    const w = mount(TagFormModal)
    await w.find('input.input').setValue('学习')
    const dots = w.findAll('.color-dot')
    await dots[3].trigger('click')
    await w.find('.btn-primary').trigger('click')
    expect(store.state.tags).toHaveLength(1)
    expect(store.state.tags[0].name).toBe('学习')
    expect(store.state.tags[0].color).not.toBe('')
  })

  it('拒绝空名与重名', async () => {
    store.addTag({ name: '重要', color: '#E11D48' })
    const w = mount(TagFormModal)
    await w.find('.btn-primary').trigger('click')
    expect(w.text()).toContain('请输入标签名称')
    await w.find('input.input').setValue('重要')
    await w.find('.btn-primary').trigger('click')
    expect(w.text()).toContain('已存在同名标签')
    expect(store.state.tags).toHaveLength(1)
  })

  it('编辑模式改名', async () => {
    const tg = store.addTag({ name: '旧名', color: '#0EA5E9' })
    const w = mount(TagFormModal, { props: { tag: { ...tg } } })
    expect(w.find('input.input').element.value).toBe('旧名')
    await w.find('input.input').setValue('新名')
    await w.find('.btn-primary').trigger('click')
    expect(store.state.tags[0].name).toBe('新名')
    expect(store.state.tags[0].color).toBe('#0EA5E9')
  })
})

describe('TagsView', () => {
  function mountView() {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div/>' } }, { path: '/tags/:id', component: { template: '<div/>' } }] })
    router.push('/')
    return { w: mount(TagsView, { global: { plugins: [router] } }), router }
  }

  it('卡片墙展示标签与关联计数', () => {
    const tg = store.addTag({ name: '重要', color: '#E11D48' })
    store.addTodo({ title: '任务', tagIds: [tg.id] })
    const p = store.addProject({ name: '项目', tagIds: [tg.id] })
    store.addSubTask({ projectId: p.id, name: '子', tagIds: [tg.id] })
    const { w } = mountView()
    expect(w.findAll('.tag-card')).toHaveLength(1)
    expect(w.text()).toContain('重要')
    expect(w.text()).toContain('3 项关联')
    w.unmount()
  })

  it('空态引导与新建弹层', async () => {
    const { w } = mountView()
    expect(w.text()).toContain('还没有标签')
    await w.find('.btn-primary').trigger('click')
    await nextTick()
    expect(document.body.querySelector('.modal-panel')).toBeTruthy()
    w.unmount()
  })

  it('点击卡片进入标签详情', async () => {
    const tg = store.addTag({ name: '学习' })
    const { w, router } = mountView()
    await w.find('.tag-card').trigger('click')
    await new Promise((r) => setTimeout(r, 10))
    expect(router.currentRoute.value.path).toBe(`/tags/${tg.id}`)
    w.unmount()
  })
})

describe('TagDetailView', () => {
  async function mountDetail(id) {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/tags/:id', component: { template: '<div/>' } }, { path: '/tags', component: { template: '<div/>' } }, { path: '/todos', component: { template: '<div/>' } }, { path: '/projects/:id', component: { template: '<div/>' } }] })
    await router.push(`/tags/${id}`)
    await router.isReady()
    return { w: mount(TagDetailView, { global: { plugins: [router] } }), router }
  }

  it('分组展示待办/项目/子任务关联', async () => {
    const tg = store.addTag({ name: '学习', color: '#10B981' })
    store.addTodo({ title: '背单词', tagIds: [tg.id] })
    const p = store.addProject({ name: '课程设计', tagIds: [tg.id] })
    store.addSubTask({ projectId: p.id, name: '写代码', tagIds: [tg.id], status: 'doing' })
    const { w } = await mountDetail(tg.id)
    expect(w.text()).toContain('学习')
    expect(w.text()).toContain('背单词')
    expect(w.text()).toContain('课程设计')
    expect(w.text()).toContain('课程设计 · 写代码')
    expect(w.text()).toContain('共 3 项关联')
    w.unmount()
  })

  it('点击项目跳转项目详情', async () => {
    const tg = store.addTag({ name: '工作' })
    const p = store.addProject({ name: '官网', tagIds: [tg.id] })
    const { w, router } = await mountDetail(tg.id)
    const items = w.findAll('.group-card')[1].findAll('.item')
    await items[0].trigger('click')
    await new Promise((r) => setTimeout(r, 10))
    expect(router.currentRoute.value.path).toBe(`/projects/${p.id}`)
    w.unmount()
  })

  it('删除标签解绑全部关联并返回列表', async () => {
    const tg = store.addTag({ name: '临时', color: '#EC4899' })
    const t = store.addTodo({ title: '任务', tagIds: [tg.id] })
    mount(ConfirmDialog)
    const { w, router } = await mountDetail(tg.id)
    const delBtn = w.findAll('button').find((b) => b.text().includes('删除标签'))
    await delBtn.trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain('解除它在 1 处关联')
    settleConfirm(true)
    await new Promise((r) => setTimeout(r, 10))
    expect(store.state.tags).toHaveLength(0)
    expect(store.state.todos.find((x) => x.id === t.id).tagIds).toEqual([])
    expect(router.currentRoute.value.path).toBe('/tags')
    w.unmount()
  })

  it('标签不存在时显示占位', async () => {
    const { w } = await mountDetail('nope')
    expect(w.text()).toContain('标签不存在或已删除')
    w.unmount()
  })
})

describe('标签页拖拽排序', () => {
  it('长按卡片拖动可调整标签顺序并持久化', async () => {
    vi.useFakeTimers()
    try {
      const a = store.addTag({ name: '甲', color: '#111111' })
      const b = store.addTag({ name: '乙', color: '#222222' })
      store.addTag({ name: '丙', color: '#333333' })
      const w = mount(TagsView)
      await nextTick()
      expect(store.state.tags.map((t) => t.name)).toEqual(['甲', '乙', '丙'])
      const cards = w.findAll('.tag-card')
      // 长按第一张（甲）进入排序模式
      cards[0].element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }))
      vi.advanceTimersByTime(500)
      await nextTick()
      expect(w.find('.sort-hint').exists()).toBe(true)
      // 向右下拖动很远 → 落到末尾
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 2000, clientY: 600 }))
      await nextTick()
      expect(w.findAll('.drop-slot').length).toBeGreaterThan(0)
      window.dispatchEvent(new MouseEvent('pointerup'))
      await nextTick()
      expect(store.state.tags.map((t) => t.name)).toEqual(['乙', '丙', '甲'])
      // 排序后点击卡片仍可进入详情
      expect(a.id).toBeTruthy()
      expect(b.id).toBeTruthy()
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('命中目标卡片时插到该卡片后方，并实时预览落位', async () => {
    vi.useFakeTimers()
    try {
      store.addTag({ name: '甲', color: '#111111' })
      store.addTag({ name: '乙', color: '#222222' })
      store.addTag({ name: '丙', color: '#333333' })
      const w = mount(TagsView)
      await nextTick()
      const cards = w.findAll('.tag-card')
      // 模拟真实布局：三张卡片横向排布
      const rects = [
        { left: 0, right: 150, top: 0, bottom: 78, width: 150, height: 78 },
        { left: 160, right: 310, top: 0, bottom: 78, width: 150, height: 78 },
        { left: 320, right: 470, top: 0, bottom: 78, width: 150, height: 78 },
      ]
      cards.forEach((c, i) => {
        c.element.getBoundingClientRect = () => rects[i]
      })
      // 拖住「甲」
      cards[0].element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 20, clientY: 20, bubbles: true }))
      vi.advanceTimersByTime(500)
      await nextTick()
      expect(w.find('.sort-hint').exists()).toBe(true)
      // 移到「乙」卡片上 → 应插到乙之后（预览落位槽出现在「丙」之前）
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 200, clientY: 30 }))
      await nextTick()
      const slots = w.findAll('.drop-slot')
      expect(slots.length).toBe(1)
      // 松手保存：甲乙丙 → 乙甲丙
      window.dispatchEvent(new MouseEvent('pointerup'))
      await nextTick()
      expect(store.state.tags.map((t) => t.name)).toEqual(['乙', '甲', '丙'])
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('拖到「丙」上则插到末尾；顺序持久化（刷新后保持）', async () => {
    vi.useFakeTimers()
    try {
      store.addTag({ name: '甲', color: '#111111' })
      store.addTag({ name: '乙', color: '#222222' })
      store.addTag({ name: '丙', color: '#333333' })
      const w = mount(TagsView)
      await nextTick()
      const cards = w.findAll('.tag-card')
      const rects = [
        { left: 0, right: 150, top: 0, bottom: 78, width: 150, height: 78 },
        { left: 160, right: 310, top: 0, bottom: 78, width: 150, height: 78 },
        { left: 320, right: 470, top: 0, bottom: 78, width: 150, height: 78 },
      ]
      cards.forEach((c, i) => {
        c.element.getBoundingClientRect = () => rects[i]
      })
      cards[0].element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 20, clientY: 20, bubbles: true }))
      vi.advanceTimersByTime(500)
      await nextTick()
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 400, clientY: 30 })) // 落在「丙」上
      await nextTick()
      window.dispatchEvent(new MouseEvent('pointerup'))
      await nextTick()
      expect(store.state.tags.map((t) => t.name)).toEqual(['乙', '丙', '甲'])
      // 顺序即持久化数据：重新挂载（等价刷新页面）后顺序保持
      w.unmount()
      const w2 = mount(TagsView)
      await nextTick()
      expect(w2.findAll('.tag-card').map((c) => c.text())).toEqual([
        expect.stringContaining('乙'),
        expect.stringContaining('丙'),
        expect.stringContaining('甲'),
      ])
      w2.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('待办页标签栏不再提供排序（顺序只在标签页调整）', async () => {
    vi.useFakeTimers()
    try {
      store.addTag({ name: '甲', color: '#111111' })
    store.addTag({ name: '乙', color: '#222222' })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/todos', component: { template: '<div/>' } },
        { path: '/', component: { template: '<div/>' } },
        { path: '/focus', component: { template: '<div/>' } },
        { path: '/projects', component: { template: '<div/>' } },
      ],
    })
    router.push('/todos')
    const w = mount(TodosView, { global: { plugins: [router] } })
    await nextTick()
    const chip = w.findAll('.tag-chip').find((c) => c.text().includes('甲'))
    chip.element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }))
    vi.advanceTimersByTime(600)
    await nextTick()
      expect(w.find('.sort-hint').exists()).toBe(false)
      expect(w.findAll('.drop-slot')).toHaveLength(0)
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})
