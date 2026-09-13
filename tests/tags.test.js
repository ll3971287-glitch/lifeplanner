import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import TagFormModal from '../src/components/tag/TagFormModal.vue'
import TagsView from '../src/views/TagsView.vue'
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
