import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { startOfDayTs, addDaysTs, DAY_MS, periodAnchorTs, fmtDate } from '../src/utils/date.js'
import ReviewFormModal from '../src/components/review/ReviewFormModal.vue'
import ReviewCard from '../src/components/review/ReviewCard.vue'
import ReviewsView from '../src/views/ReviewsView.vue'
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

describe('ReviewFormModal', () => {
  it('填写五字段保存为当日复盘', async () => {
    const w = mount(ReviewFormModal, { props: { defaultType: 'day' } })
    const textareas = w.findAll('textarea')
    await textareas[0].setValue('计划内容A')
    await textareas[1].setValue('事件B')
    await textareas[2].setValue('问题C')
    await textareas[3].setValue('方案D')
    await textareas[4].setValue('总结E')
    await w.find('.btn-primary').trigger('click')
    expect(store.state.reviews).toHaveLength(1)
    const r = store.state.reviews[0]
    expect(r.type).toBe('day')
    expect(r.periodDate).toBe(periodAnchorTs('day', Date.now()))
    expect(r.fields.plan).toBe('计划内容A')
    expect(r.fields.summary).toBe('总结E')
  })

  it('切换周复盘并移动到上一周', async () => {
    const w = mount(ReviewFormModal, { props: { defaultType: 'day' } })
    const segs = w.findAll('.seg-item')
    await segs[1].trigger('click') // 周复盘
    const chips = w.findAll('.quick-chip')
    await chips[0].trigger('click') // 上一周
    await w.find('.btn-primary').trigger('click')
    const r = store.state.reviews[0]
    expect(r.type).toBe('week')
    const expected = periodAnchorTs('week', Date.now()) - 7 * DAY_MS
    expect(r.periodDate).toBe(expected)
  })

  it('插入本周期完成情况到事件字段', async () => {
    const t = store.addTodo({ title: '完成任务X' })
    store.toggleTodo(t.id, true)
    const w = mount(ReviewFormModal, { props: { defaultType: 'day' } })
    const btn = w.findAll('button').find((b) => b.text().includes('插入本周期完成情况'))
    await btn.trigger('click')
    const eventsArea = w.findAll('textarea')[1]
    expect(eventsArea.element.value).toContain('完成任务X')
  })

  it('无完成记录时提示', async () => {
    const w = mount(ReviewFormModal, { props: { defaultType: 'week' } })
    const btn = w.findAll('button').find((b) => b.text().includes('插入本周期完成情况'))
    await btn.trigger('click')
    const eventsArea = w.findAll('textarea')[1]
    expect(eventsArea.element.value).toBe('')
  })

  it('编辑模式回显内容并保存修改', async () => {
    const r = store.addReview({ type: 'day', periodDate: startOfDayTs(Date.now()), fields: { plan: '旧计划', summary: '旧总结' } })
    const w = mount(ReviewFormModal, { props: { review: { ...r } } })
    const areas = w.findAll('textarea')
    expect(areas[0].element.value).toBe('旧计划')
    await areas[0].setValue('新计划')
    await w.find('.btn-primary').trigger('click')
    expect(store.state.reviews[0].fields.plan).toBe('新计划')
    expect(store.state.reviews).toHaveLength(1)
  })
})

describe('ReviewCard', () => {
  it('展开显示五字段，收起显示总结', async () => {
    const r = { id: 'r1', type: 'day', periodDate: startOfDayTs(Date.now()), fields: { plan: 'P', events: 'E', problems: 'Q', improvement: 'I', summary: 'S总结' }, createdAt: 1, updatedAt: 2 }
    const w = mount(ReviewCard, { props: { review: r } })
    expect(w.text()).toContain('P')
    expect(w.text()).toContain('S总结')
    const btns = w.findAll('.mini-btn')
    await btns[2].trigger('click') // 收起
    expect(w.text()).toContain('总结：S总结')
    expect(w.text()).not.toContain('事件：E')
    w.unmount()
  })

  it('周期标记直白展示（类型名 + 周期范围 + 首字色块）', () => {
    const r = { id: 'r2', type: 'week', periodDate: startOfDayTs(Date.now()), fields: {}, createdAt: 1, updatedAt: 2 }
    const w = mount(ReviewCard, { props: { review: r } })
    const mark = w.find('.mark-icon')
    expect(mark.exists()).toBe(true)
    expect(mark.text()).toBe('周')
    expect(mark.attributes('style')).toContain('rgb(124, 58, 237)') // #7C3AED
    const typeName = w.find('.type-name')
    expect(typeName.text()).toBe('周复盘')
    expect(w.text()).toContain('~') // 周期范围（周一 ~ 周日）
    w.unmount()
  })
})

describe('ReviewsView', () => {
  function mountView() {
    return mount(ReviewsView)
  }

  it('按周期分段展示历史', async () => {
    const today = startOfDayTs(Date.now())
    store.addReview({ type: 'day', periodDate: today, fields: { summary: '今日总结' } })
    store.addReview({ type: 'day', periodDate: today - DAY_MS, fields: { summary: '昨日总结' } })
    store.addReview({ type: 'week', periodDate: periodAnchorTs('week', Date.now()), fields: { summary: '周总结' } })
    const w = mountView()
    await nextTick()
    expect(w.findAll('.review-card')).toHaveLength(2)
    expect(w.text()).toContain('昨日总结')
    const segs = w.findAll('.seg-item')
    await segs[1].trigger('click') // 周
    await nextTick()
    expect(w.findAll('.review-card')).toHaveLength(1)
    expect(w.text()).toContain('周总结')
    w.unmount()
  })

  it('写新复盘保存并出现在列表', async () => {
    const w = mountView()
    await w.find('.btn-primary').trigger('click')
    await nextTick()
    const panel = document.body.querySelector('.modal-panel')
    expect(panel).toBeTruthy()
    const areas = panel.querySelectorAll('textarea')
    areas[4].value = '今天总结'
    areas[4].dispatchEvent(new Event('input'))
    await nextTick()
    const saveBtn = [...panel.querySelectorAll('button')].find((b) => b.textContent.includes('保存复盘'))
    saveBtn.click()
    await new Promise((r) => setTimeout(r, 10))
    expect(store.state.reviews).toHaveLength(1)
    expect(w.text()).toContain('今天总结')
    w.unmount()
  })

  it('删除复盘需确认', async () => {
    store.addReview({ type: 'day', periodDate: startOfDayTs(Date.now()), fields: { summary: '待删' } })
    mount(ConfirmDialog)
    const w = mountView()
    await nextTick()
    const delBtn = w.find('.mini-btn.danger')
    await delBtn.trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain('确定删除这条日复盘')
    settleConfirm(true)
    await new Promise((r) => setTimeout(r, 10))
    expect(store.state.reviews).toHaveLength(0)
    w.unmount()
  })
})
