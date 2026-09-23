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
  it('日复盘为日记体：三个模块分别写入 events / problems / summary', async () => {
    const w = mount(ReviewFormModal, { props: { defaultType: 'day' } })
    const textareas = w.findAll('textarea')
    expect(textareas).toHaveLength(3) // 今天的计划？/ 今天的事件 / 今天的感受
    await textareas[0].setValue('今天想做的事')
    await textareas[1].setValue('今天发生的事')
    await textareas[2].setValue('今天的感受')
    await w.find('.btn-primary').trigger('click')
    expect(store.state.reviews).toHaveLength(1)
    const r = store.state.reviews[0]
    expect(r.type).toBe('day')
    expect(r.periodDate).toBe(periodAnchorTs('day', Date.now()))
    expect(r.fields.events).toBe('今天想做的事')
    expect(r.fields.problems).toBe('今天发生的事')
    expect(r.fields.summary).toBe('今天的感受')
  })

  it('日复盘模块名与顺序：今天的计划？→ 今天的事件 → 今天的感受 → 关联目标（最末尾），无旧模块', async () => {
    store.addGoal({ year: new Date().getFullYear(), scope: 'month', index: new Date().getMonth(), name: '本月目标Z' })
    const w = mount(ReviewFormModal, { props: { defaultType: 'day' } })
    await nextTick()
    const text = w.text()
    // 旧模块已移除
    expect(text).not.toContain('计划内容')
    expect(text).not.toContain('新旧问题反思')
    expect(text).not.toContain('优化改善方案')
    expect(text).not.toContain('整体总结')
    // 新模块
    expect(text).toContain('今天的计划？')
    expect(text).toContain('今天的事件')
    expect(text).toContain('今天的感受')
    expect(text).toContain('关联目标')
    // 所属周期字段保留
    expect(text).toContain('所属周期')
    // 「今天的计划？」保留插入功能
    expect(text).toContain('插入本周期完成情况')
    expect(text).toContain('插入书影音记录')
    // 关联目标位于最后（在今天的感受之后，且紧邻保存按钮之前）
    const html = w.html()
    expect(html.indexOf('关联目标')).toBeGreaterThan(html.indexOf('今天的感受'))
    expect(html.indexOf('关联目标')).toBeLessThan(html.indexOf('form-actions'))
  })

  it('其它周期仍保持原有五个模块', async () => {
    const w = mount(ReviewFormModal, { props: { defaultType: 'week' } })
    const text = w.text()
    expect(text).toContain('计划内容')
    expect(text).toContain('当日 / 周期事件')
    expect(text).toContain('新旧问题反思')
    expect(text).toContain('优化改善方案')
    expect(text).toContain('整体总结')
    expect(text).not.toContain('今天的计划？')
    expect(w.findAll('textarea')).toHaveLength(5)
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
    // 日复盘：「今天的计划？」对应 events（第 0 个 textarea）
    const eventsArea = w.findAll('textarea')[0]
    expect(eventsArea.element.value).toContain('完成任务X')
  })

  it('无完成记录时提示', async () => {
    const w = mount(ReviewFormModal, { props: { defaultType: 'week' } })
    const btn = w.findAll('button').find((b) => b.text().includes('插入本周期完成情况'))
    await btn.trigger('click')
    const eventsArea = w.findAll('textarea')[1]
    expect(eventsArea.element.value).toBe('')
  })

  it('编辑模式回显内容并保存修改（日复盘）', async () => {
    const r = store.addReview({ type: 'day', periodDate: startOfDayTs(Date.now()), fields: { events: '旧计划', problems: '旧事件', summary: '旧感受' } })
    const w = mount(ReviewFormModal, { props: { review: { ...r } } })
    const areas = w.findAll('textarea')
    expect(areas[0].element.value).toBe('旧计划')
    expect(areas[1].element.value).toBe('旧事件')
    expect(areas[2].element.value).toBe('旧感受')
    await areas[2].setValue('新感受')
    await w.find('.btn-primary').trigger('click')
    expect(store.state.reviews[0].fields.summary).toBe('新感受')
    expect(store.state.reviews[0].fields.events).toBe('旧计划')
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
    // 日复盘：第 3 个 textarea 是「今天的感受」(summary)
    areas[2].value = '今天总结'
    areas[2].dispatchEvent(new Event('input'))
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
