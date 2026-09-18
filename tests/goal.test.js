import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { goalsOf, goalProgress, goalNoteOf, reviewGoals } from '../src/selectors.js'
import { periodTitle, periodMonths, noteKey } from '../src/goalMeta.js'
import GoalsPanel from '../src/components/goal/GoalsPanel.vue'
import GoalPeriodCard from '../src/components/goal/GoalPeriodCard.vue'
import ReviewsView from '../src/views/ReviewsView.vue'
import GoalsView from '../src/views/GoalsView.vue'
import ReviewFormModal from '../src/components/review/ReviewFormModal.vue'
import ReviewCard from '../src/components/review/ReviewCard.vue'

beforeEach(() => {
  store._replace(defaultState())
  const f = store.focusState
  f.visible = false
  f.phase = 'idle'
})

afterEach(() => {
  document.body.innerHTML = ''
})

const YEAR = new Date().getFullYear()

describe('目标数据与周期工具', () => {
  it('新增目标按年/周期/序号隔离', () => {
    const a = store.addGoal({ year: YEAR, scope: 'month', index: 2, name: '月目标A' })
    const b = store.addGoal({ year: YEAR, scope: 'month', index: 2, name: '月目标B', desc: '说明' })
    store.addGoal({ year: YEAR, scope: 'month', index: 3, name: '另一个月' })
    store.addGoal({ year: YEAR, scope: 'quarter', index: 0, name: '季度目标' })
    expect(a.order).toBe(0)
    expect(b.order).toBe(1)
    expect(goalsOf(store.state, YEAR, 'month', 2)).toHaveLength(2)
    expect(goalsOf(store.state, YEAR, 'month', 3)).toHaveLength(1)
    expect(goalsOf(store.state, YEAR, 'quarter', 0)).toHaveLength(1)
    expect(periodTitle(YEAR, 'quarter', 1)).toBe(`${YEAR} 年 第 2 季度`)
    expect(periodMonths('quarter', 1)).toEqual([3, 4, 5])
  })

  it('勾选完成与进度统计', () => {
    const a = store.addGoal({ year: YEAR, scope: 'month', index: 0, name: 'A' })
    store.addGoal({ year: YEAR, scope: 'month', index: 0, name: 'B' })
    expect(goalProgress(store.state, YEAR, 'month', 0)).toEqual({ done: 0, total: 2 })
    store.toggleGoalDone(a.id)
    expect(goalProgress(store.state, YEAR, 'month', 0)).toEqual({ done: 1, total: 2 })
    store.toggleGoalDone(a.id, false)
    expect(goalProgress(store.state, YEAR, 'month', 0)).toEqual({ done: 0, total: 2 })
  })

  it('自由文本保存与清空', () => {
    store.setGoalNote(YEAR, 'month', 4, '这个月的想法')
    expect(goalNoteOf(store.state, YEAR, 'month', 4)).toBe('这个月的想法')
    expect(store.state.goalNotes[noteKey(YEAR, 'month', 4)]).toBe('这个月的想法')
    store.setGoalNote(YEAR, 'month', 4, '   ')
    expect(goalNoteOf(store.state, YEAR, 'month', 4)).toBe('')
    expect(store.state.goalNotes[noteKey(YEAR, 'month', 4)]).toBeUndefined()
  })

  it('删除目标会清理复盘里的关联引用，但不影响复盘其它内容', () => {
    const g = store.addGoal({ year: YEAR, scope: 'month', index: 0, name: '会被删的目标' })
    const r = store.addReview({ type: 'month', fields: { summary: '保留的总结' }, goals: [g.id] })
    expect(reviewGoals(store.state, r)).toHaveLength(1)
    store.deleteGoal(g.id)
    const after = store.state.reviews.find((x) => x.id === r.id)
    expect(after.goals).toEqual([])
    expect(after.fields.summary).toBe('保留的总结')
  })
})

describe('目标板块 UI', () => {
  it('默认月度视图渲染 12 张卡，切季度渲染 4 张', async () => {
    const w = mount(GoalsPanel)
    await nextTick()
    expect(w.findAll('.gp-card')).toHaveLength(12)
    const segs = w.findAll('.seg-item')
    await segs[1].trigger('click') // 季度
    await nextTick()
    expect(w.findAll('.gp-card')).toHaveLength(4)
    await segs[0].trigger('click')
    await nextTick()
    expect(w.findAll('.gp-card')).toHaveLength(12)
    w.unmount()
  })

  it('进入时定位并标记当前月/当前季度卡片', async () => {
    const scrollSpy = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollSpy
    const w = mount(GoalsPanel)
    await nextTick()
    await nextTick()
    // 当前月卡片带 is-current 标记且被滚动定位
    const cards = w.findAll('.gp-card')
    const monthIdx = new Date().getMonth()
    expect(cards[monthIdx].classes()).toContain('is-current')
    expect(cards.filter((c) => c.classes().includes('is-current'))).toHaveLength(1)
    expect(scrollSpy).toHaveBeenCalled()
    // 切到季度视图 → 当前季度卡片被标记
    const segs = w.findAll('.seg-item')
    await segs[1].trigger('click')
    await nextTick()
    await nextTick()
    const qCards = w.findAll('.gp-card')
    const qIdx = Math.floor(new Date().getMonth() / 3)
    expect(qCards[qIdx].classes()).toContain('is-current')
    // 切到非今年 → 不再有"当前"标记
    await w.findAll('.nav-btn')[0].trigger('click')
    await nextTick()
    expect(w.findAll('.gp-card.is-current')).toHaveLength(0)
    delete window.HTMLElement.prototype.scrollIntoView
    w.unmount()
  })

  it('年份可切换并回到今年', async () => {
    const w = mount(GoalsPanel)
    await nextTick()
    expect(w.text()).toContain(`${YEAR} 年`)
    const navBtns = w.findAll('.nav-btn')
    await navBtns[0].trigger('click') // 上一年
    await nextTick()
    expect(w.text()).toContain(`${YEAR - 1} 年`)
    await w.find('.mini-btn').trigger('click') // 今年
    await nextTick()
    expect(w.text()).toContain(`${YEAR} 年`)
    w.unmount()
  })

  it('卡内可新增、勾选、删除目标，进度实时变化', async () => {
    const w = mount(GoalPeriodCard, { props: { year: YEAR, scope: 'month', index: 0 } })
    await nextTick()
    expect(w.text()).toContain('添加目标')
    // 新增
    await w.find('.add-goal').trigger('click')
    const inputs = w.findAll('.gp-input')
    await inputs[0].setValue('读完三本书')
    await inputs[1].setValue('每月一本')
    const okBtn = w.findAll('.mini.op.ok')[0]
    await okBtn.trigger('click')
    await nextTick()
    expect(goalsOf(store.state, YEAR, 'month', 0)).toHaveLength(1)
    expect(w.text()).toContain('读完三本书')
    expect(w.text()).toContain('0/1')
    // 勾选
    await w.find('.tick').trigger('click')
    await nextTick()
    expect(w.text()).toContain('1/1')
    // 删除
    const g = goalsOf(store.state, YEAR, 'month', 0)[0]
    await w.findAll('.mini.op.danger')[0].trigger('click')
    await nextTick()
    expect(store.state.goals.find((x) => x.id === g.id)).toBeUndefined()
    w.unmount()
  })

  it('自由文本区输入后自动保存', async () => {
    vi.useFakeTimers()
    try {
      const w = mount(GoalPeriodCard, { props: { year: YEAR, scope: 'month', index: 5 } })
      await w.find('.gp-note').setValue('六月要做的事')
      vi.advanceTimersByTime(600)
      expect(goalNoteOf(store.state, YEAR, 'month', 5)).toBe('六月要做的事')
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('复盘页目标入口与关联', () => {
  it('复盘页不再内嵌目标板块（已拆为独立页面）', async () => {
    store.addGoal({ year: YEAR, scope: 'month', index: 0, name: '入口前的目标' })
    const w = mount(ReviewsView)
    await nextTick()
    expect(w.find('.goal-entry').exists()).toBe(false)
    expect(w.text()).not.toContain('个目标')
    w.unmount()
  })

  it('独立目标页面：渲染 12 张月度卡，且没有“返回复盘”', async () => {
    const w = mount(GoalsView)
    await nextTick()
    expect(w.findAll('.gp-card')).toHaveLength(12)
    expect(w.text()).not.toContain('返回复盘')
    expect(w.text()).toContain('目标')
    w.unmount()
  })

  it('复盘表单可关联当周期目标，卡片显示关联目标名；改复盘不动目标数据', async () => {
    const g = store.addGoal({ year: YEAR, scope: 'month', index: new Date().getMonth(), name: '本月目标X' })
    const w = mount(ReviewFormModal, { props: { defaultType: 'month' } })
    await nextTick()
    const chip = w.findAll('.goal-chip').find((c) => c.text().includes('本月目标X'))
    expect(chip).toBeTruthy()
    await chip.trigger('click')
    await nextTick()
    expect(w.emitted()).toBeTruthy()
    // 保存
    const saveBtn = w.findAll('button').find((b) => b.text().includes('保存'))
    await saveBtn.trigger('click')
    const review = store.state.reviews[0]
    expect(review.goals).toEqual([g.id])
    // 复盘卡片显示关联目标（只读）
    const card = mount(ReviewCard, { props: { review } })
    await nextTick()
    expect(card.text()).toContain('本月目标X')
    // 修改复盘内容不影响目标原始数据
    store.updateReview(review.id, { fields: { ...review.fields, summary: '改了总结' } })
    const after = store.state.goals.find((x) => x.id === g.id)
    expect(after.name).toBe('本月目标X')
    expect(after.done).toBe(false)
    expect(after.desc).toBe('')
    card.unmount()
    w.unmount()
  })
})
