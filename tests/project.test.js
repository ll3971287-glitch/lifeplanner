import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { parseDateStr } from '../src/utils/date.js'
import ProjectFormModal from '../src/components/project/ProjectFormModal.vue'
import { catOf } from '../src/projectMeta.js'
import ProjectsView from '../src/views/ProjectsView.vue'
import ProjectDetailView from '../src/views/ProjectDetailView.vue'
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

function stubRouter(routes) {
  return createRouter({ history: createMemoryHistory(), routes })
}

describe('ProjectFormModal', () => {
  it('新建项目默认学习类型并保存 deadline', async () => {
    const w = mount(ProjectFormModal)
    await w.find('input.input').setValue('毕业论文')
    const dateInput = w.find('input[type="date"]')
    dateInput.element.value = '2026-12-31'
    await dateInput.trigger('change')
    await w.find('.btn-primary').trigger('click')
    expect(store.state.projects).toHaveLength(1)
    const p = store.state.projects[0]
    expect(p.name).toBe('毕业论文')
    expect(p.type).toBe('学习')
    expect(p.deadline).toBe(parseDateStr('2026-12-31'))
  })

  it('选择按累计时长模式后保存 progressMode=hours', async () => {
    const w = mount(ProjectFormModal)
    await w.find('input.input').setValue('外包项目')
    const segs = w.findAll('.seg-item')
    // 类型 2 项 + 分类 3 项 + 进度规则 2 项 = 7
    expect(segs).toHaveLength(7)
    await segs[6].trigger('click') // 进度规则第二项
    await w.find('.btn-primary').trigger('click')
    expect(store.state.projects[0].progressMode).toBe('hours')
  })

  it('空名称校验', async () => {
    const w = mount(ProjectFormModal)
    await w.find('.btn-primary').trigger('click')
    expect(w.text()).toContain('请填写项目名称')
    expect(store.state.projects).toHaveLength(0)
  })
})

describe('项目分类（学习/项目/规划）', () => {
  it('表单可选分类并保存', async () => {
    const w = mount(ProjectFormModal)
    await w.find('input.input').setValue('考研计划')
    const segs = w.findAll('.seg-item')
    await segs[3].trigger('click') // 分类第二项 = 项目分类
    await w.find('.btn-primary').trigger('click')
    expect(store.state.projects[0].category).toBe('project')
    const w2 = mount(ProjectFormModal)
    await w2.find('input.input').setValue('学英语')
    const segs2 = w2.findAll('.seg-item')
    await segs2[2].trigger('click') // 分类第一项 = 学习分类
    await w2.find('.btn-primary').trigger('click')
    expect(store.state.projects[1].category).toBe('study')
  })

  it('老项目（无分类字段）按原类型兜底', () => {
    const p = store.addProject({ name: '老的' })
    delete p.category
    p.type = '学习'
    expect(catOf(p)).toBe('study')
    p.type = '工作'
    expect(catOf(p)).toBe('project')
  })

  it('蓝图拆解生成的项目归入规划分类', () => {
    const b = store.addBlueprint({ title: '写一本书' })
    const p = store.breakdownProject(b.id)
    expect(p.category).toBe('plan')
  })
})

describe('ProjectsView', () => {
  function mountView() {
    const router = stubRouter([
      { path: '/', component: { template: '<div/>' } },
      { path: '/projects/:id', component: { template: '<div/>' } },
    ])
    return { w: mount(ProjectsView, { global: { plugins: [router] } }), router }
  }

  it('分类标签切换：只渲染当前分类下的项目', async () => {
    store.addProject({ name: '学习的事', category: 'study' })
    store.addProject({ name: '项目的事', category: 'project' })
    store.addProject({ name: '规划的事', category: 'plan' })
    const { w } = mountView()
    await nextTick()
    // 默认项目分类：只看到项目分类的项目
    expect(w.text()).toContain('项目的事')
    expect(w.text()).not.toContain('学习的事')
    expect(w.text()).not.toContain('规划的事')
    // 切到学习分类
    const segs = w.findAll('.seg-item')
    await segs[0].trigger('click')
    await nextTick()
    expect(w.text()).toContain('学习的事')
    expect(w.text()).not.toContain('项目的事')
    // 切到规划分类
    await segs[2].trigger('click')
    await nextTick()
    expect(w.text()).toContain('规划的事')
    expect(w.text()).not.toContain('学习的事')
    w.unmount()
  })

  it('点卡片上的分类徽章可把项目改到其它分类', async () => {
    store.addProject({ name: '要挪的项目', category: 'project' })
    const { w } = mountView()
    await nextTick()
    expect(w.text()).toContain('要挪的项目')
    await w.find('.cat-badge').trigger('click')
    await nextTick()
    const opts = [...document.querySelectorAll('.cat-opt')]
    expect(opts.length).toBe(3)
    opts[0].click() // 学习分类
    await nextTick()
    expect(store.state.projects[0].category).toBe('study')
    // 当前（项目分类）列表里不再显示
    expect(w.text()).not.toContain('要挪的项目')
    w.unmount()
  })

  it('卡片展示项目进度（项目任务=普通待办）', () => {
    const p = store.addProject({ name: '进行中项目' })
    store.addSubTask({ projectId: p.id, name: 'a' })
    store.addSubTask({ projectId: p.id, name: 'b' })
    store.cycleSubTaskStatus(store.state.todos.find((t) => t.title === 'a').id)
    const { w } = mountView()
    expect(w.text()).toContain('进行中项目')
    expect(w.text()).toContain('1/2 子任务')
    expect(w.text()).toContain('50%')
    w.unmount()
  })

  it('缩略卡片：超长标题/描述截断（省略容器），进度条完整渲染', () => {
    const longName = '超'.repeat(80)
    const longDesc = '很长的项目描述内容。'.repeat(60)
    const p = store.addProject({ name: longName, desc: longDesc })
    store.addSubTask({ projectId: p.id, name: 'a' })
    const { w } = mountView()
    const nameEl = w.find('.p-name')
    const descEl = w.find('.p-desc')
    expect(nameEl.attributes('title')).toBe(longName)
    expect(descEl.attributes('title')).toBe(longDesc)
    expect(descEl.classes()).toContain('desc-clamp')
    expect(w.find('.prog-slot .progress').exists()).toBe(true)
    w.unmount()
  })

  it('点击卡片跳转详情路由', async () => {
    const p = store.addProject({ name: '点我' })
    const { w, router } = mountView()
    await w.find('.p-card').trigger('click')
    await new Promise((r) => setTimeout(r, 10))
    expect(router.currentRoute.value.path).toBe(`/projects/${p.id}`)
    w.unmount()
  })

  it('归档后进入已完成区', async () => {
    const p = store.addProject({ name: '将归档' })
    store.archiveProject(p.id)
    const { w } = mountView()
    expect(w.find('.arch-head').exists()).toBe(true)
    expect(w.text()).toContain('已完成（1）')
    w.unmount()
  })
})

describe('ProjectDetailView 项目任务（普通待办语义）', () => {
  async function mountDetail(projectId) {
    const router = stubRouter([{ path: '/projects/:id', component: { template: '<div/>' } }, { path: '/projects', component: { template: '<div/>' } }])
    await router.push(`/projects/${projectId}`)
    await router.isReady()
    return mount(ProjectDetailView, { global: { plugins: [router] } })
  }

  it('网格一格一项目任务，可勾选完成', async () => {
    const p = store.addProject({ name: '网格项目' })
    const a = store.addSubTask({ projectId: p.id, name: '任务A' })
    const b = store.addSubTask({ projectId: p.id, name: '任务B', dueAt: parseDateStr('2026-10-01') + 9 * 3600000 })
    const w = await mountDetail(p.id)
    await nextTick()
    const cells = w.findAll('.sub-cell')
    expect(cells).toHaveLength(2)
    expect(w.text()).toContain('0/2')
    expect(w.text()).toContain('0%')
    // 勾选完成
    await cells[0].find('.check').trigger('click')
    await nextTick()
    expect(store.state.todos.find((x) => x.id === a.id).completed).toBe(true)
    expect(w.text()).toContain('1/2')
    expect(w.text()).toContain('50%')
    // 取消勾选
    await w.findAll('.sub-cell .check')[0].trigger('click')
    await nextTick()
    expect(store.state.todos.find((x) => x.id === a.id).completed).toBe(false)
    w.unmount()
  })

  it('全部任务完成后出现归档按钮并归档', async () => {
    const p = store.addProject({ name: 'P' })
    const a = store.addSubTask({ projectId: p.id, name: 'a' })
    const b = store.addSubTask({ projectId: p.id, name: 'b' })
    store.toggleTodo(a.id, true)
    store.toggleTodo(b.id, true)
    mount(ConfirmDialog)
    const w = await mountDetail(p.id)
    await nextTick()
    const archiveBtn = w.findAll('button').find((b) => b.text().includes('归档项目'))
    expect(archiveBtn).toBeTruthy()
    await archiveBtn.trigger('click')
    await nextTick()
    settleConfirm(true)
    await new Promise((r) => setTimeout(r, 10))
    expect(store.state.projects.find((x) => x.id === p.id).completed).toBe(true)
    w.unmount()
  })

  it('点击格子打开普通待办抽屉', async () => {
    const p = store.addProject({ name: 'P' })
    store.addSubTask({ projectId: p.id, name: '可点任务' })
    const w = await mountDetail(p.id)
    await nextTick()
    await w.find('.sub-cell').trigger('click')
    await nextTick()
    const drawer = document.body.querySelector('.drawer-panel')
    expect(drawer).toBeTruthy()
    expect(drawer.textContent).toContain('可点任务')
    w.unmount()
  })

  it('新建任务按钮打开带项目归属的表单', async () => {
    const p = store.addProject({ name: 'P' })
    const w = await mountDetail(p.id)
    await nextTick()
    const addBtn = w.findAll('button').find((b) => b.text().includes('新建任务'))
    await addBtn.trigger('click')
    await nextTick()
    const panel = document.body.querySelector('.modal-panel')
    expect(panel).toBeTruthy()
    expect(panel.textContent).toContain('所属项目')
    expect(panel.textContent).toContain('P')
    w.unmount()
  })

  it('状态筛选 未完成/已完成 生效', async () => {
    const p = store.addProject({ name: 'P' })
    const doneTask = store.addSubTask({ projectId: p.id, name: '已完成任务' })
    store.addSubTask({ projectId: p.id, name: '未完成任务' })
    store.toggleTodo(doneTask.id, true)
    const w = await mountDetail(p.id)
    await nextTick()
    expect(w.findAll('.sub-cell')).toHaveLength(2)
    const selects = w.findAll('select')
    await selects[0].setValue('done')
    await nextTick()
    expect(w.findAll('.sub-cell')).toHaveLength(1)
    expect(w.text()).toContain('已完成任务')
    expect(w.text()).not.toContain('未完成任务')
    w.unmount()
  })

  it('删除项目需确认并级联清任务', async () => {
    const p = store.addProject({ name: '待删' })
    store.addSubTask({ projectId: p.id, name: 'x' })
    mount(ConfirmDialog)
    const w = await mountDetail(p.id)
    await nextTick()
    await w.find('.icon-btn.danger').trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain('将同时删除 1 个任务')
    settleConfirm(true)
    await new Promise((r) => setTimeout(r, 10))
    expect(store.state.projects).toHaveLength(0)
    expect(store.state.todos).toHaveLength(0)
    w.unmount()
  })
})
