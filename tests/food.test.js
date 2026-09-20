import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { foodList, foodAlerts, foodStats } from '../src/selectors.js'
import { suggestDays, suggestExpireAt, daysLeft, foodLevel, leftText, NEAR_DAYS } from '../src/foodMeta.js'
import FoodView from '../src/views/FoodView.vue'
import FoodCard from '../src/components/food/FoodCard.vue'
import FoodFormModal from '../src/components/food/FoodFormModal.vue'
import { startOfDayTs, endOfDayTs, DAY_MS } from '../src/utils/date.js'

beforeEach(() => {
  store._replace(defaultState())
})

afterEach(() => {
  document.body.innerHTML = ''
})

const today0 = () => startOfDayTs(Date.now())

describe('食物：保质期预设与状态判定', () => {
  it('按分类 + 位置 + 开封状态给出参考天数', () => {
    expect(suggestDays('蔬菜', 'fridge', false)).toBe(7)
    expect(suggestDays('蔬菜', 'fridge', true)).toBe(3)
    expect(suggestDays('肉类', 'freezer', false)).toBe(180)
    expect(suggestDays('肉类', 'room', false)).toBeNull() // 常温不适用
    expect(suggestDays('蛋类', 'fridge', true)).toBe(14)
  })

  it('建议过期时间 = 入库日 + 参考天数（当天 23:59）', () => {
    const stored = today0()
    const exp = suggestExpireAt(stored, '蔬菜', 'fridge', false)
    expect(daysLeft(exp, stored)).toBe(7)
    expect(exp).toBe(endOfDayTs(stored + 7 * DAY_MS))
  })

  it('过期判定：过了过期日才算过期，当天仍是临期', () => {
    const stored = today0()
    const make = (offsetDays) => ({ status: 'stored', expireAt: stored + offsetDays * DAY_MS })
    expect(foodLevel(make(-1))).toBe('over') // 昨天到期 → 已过期
    expect(foodLevel(make(0))).toBe('near') // 今天到期 → 临期
    expect(foodLevel(make(2))).toBe('near') // 剩 2 天 → 临期
    expect(foodLevel(make(NEAR_DAYS))).toBe('near')
    expect(foodLevel(make(NEAR_DAYS + 1))).toBe('ok') // 超过阈值 → 安全
    expect(foodLevel({ status: 'consumed', expireAt: stored - DAY_MS })).toBe('off')
    expect(leftText(make(-2))).toContain('已过期 2 天')
    expect(leftText(make(0))).toBe('今天到期')
    expect(leftText(make(5))).toBe('剩 5 天')
  })
})

describe('食物：store 与查询', () => {
  it('新增/编辑/消耗/丢弃/恢复/删除，并统计周期内数量', () => {
    const a = store.addFood({ name: '牛奶', category: '奶制品', place: 'fridge' })
    const b = store.addFood({ name: '牛肉', category: '肉类', place: 'freezer' })
    expect(a.status).toBe('stored')
    store.updateFood(a.id, { opened: true })
    expect(store.state.foodItems[0].opened).toBe(true)
    // 消耗 / 丢弃
    store.markFoodConsumed(a.id)
    store.markFoodDiscarded(b.id)
    expect(store.state.foodItems.find((f) => f.id === a.id).consumedAt).not.toBeNull()
    expect(store.state.foodItems.find((f) => f.id === b.id).discardedAt).not.toBeNull()
    const [ws, we] = [today0() - DAY_MS, today0() + DAY_MS]
    expect(foodStats(store.state, ws, we)).toEqual({ consumed: 1, discarded: 1 })
    // 恢复入库
    store.restoreFood(a.id)
    expect(store.state.foodItems.find((f) => f.id === a.id).status).toBe('stored')
    expect(store.state.foodItems.find((f) => f.id === a.id).consumedAt).toBeNull()
    // 删除
    store.deleteFood(b.id)
    expect(store.state.foodItems).toHaveLength(1)
  })

  it('列表默认按过期时间由近到远，支持位置/开封/状态筛选', () => {
    const d = today0()
    store.addFood({ name: '远的', place: 'freezer', expireAt: d + 30 * DAY_MS })
    store.addFood({ name: '近的', place: 'fridge', expireAt: d + 2 * DAY_MS, opened: true })
    store.addFood({ name: '已过期', place: 'fridge', expireAt: d - DAY_MS })
    const eaten = store.addFood({ name: '已消耗', place: 'fridge', expireAt: d + 5 * DAY_MS })
    store.markFoodConsumed(eaten.id)
    const list = foodList(store.state, {})
    expect(list.map((f) => f.name)).toEqual(['已过期', '近的', '远的'])
    expect(foodList(store.state, { place: 'fridge' }).map((f) => f.name)).toEqual(['已过期', '近的'])
    expect(foodList(store.state, { opened: true }).map((f) => f.name)).toEqual(['近的'])
    expect(foodList(store.state, { status: 'consumed' }).map((f) => f.name)).toEqual(['已消耗'])
  })

  it('临期/过期提醒只统计在库条目', () => {
    const d = today0()
    store.addFood({ name: '过期了', expireAt: d - DAY_MS })
    store.addFood({ name: '临期了', expireAt: d + 2 * DAY_MS })
    store.addFood({ name: '安全的', expireAt: d + 30 * DAY_MS })
    const thrown = store.addFood({ name: '已丢弃的过期品', expireAt: d - 5 * DAY_MS })
    store.markFoodDiscarded(thrown.id)
    const { over, near } = foodAlerts(store.state)
    expect(over.map((f) => f.name)).toEqual(['过期了'])
    expect(near.map((f) => f.name)).toEqual(['临期了'])
  })
})

describe('食物：剩余百分比', () => {
  it('新增默认 100%，扣减到 0 自动转为已消耗，恢复后回到 100%', () => {
    const f = store.addFood({ name: '酸奶', place: 'fridge', expireAt: today0() + 5 * DAY_MS })
    expect(f.percent).toBe(100)
    store.setFoodPercent(f.id, 75)
    expect(store.state.foodItems[0].percent).toBe(75)
    expect(store.state.foodItems[0].status).toBe('stored')
    store.setFoodPercent(f.id, 0)
    const after = store.state.foodItems[0]
    expect(after.percent).toBe(0)
    expect(after.status).toBe('consumed')
    expect(after.consumedAt).not.toBeNull()
    // 恢复入库 → 百分比回到 100%
    store.restoreFood(f.id)
    expect(store.state.foodItems[0].status).toBe('stored')
    expect(store.state.foodItems[0].percent).toBe(100)
  })

  it('表单把百分比设为 0 保存后等同已消耗', () => {
    const f = store.addFood({ name: '酸奶', place: 'fridge', expireAt: today0() + 5 * DAY_MS })
    store.updateFood(f.id, { percent: 0 })
    expect(store.state.foodItems[0].status).toBe('consumed')
    // 普通编辑（非 0）不影响状态
    store.restoreFood(f.id)
    store.updateFood(f.id, { percent: 40 })
    expect(store.state.foodItems[0].status).toBe('stored')
    expect(store.state.foodItems[0].percent).toBe(40)
  })

  it('卡片显示剩余百分比，点 −25% 逐次扣减，到 0 移出列表', async () => {
    store.addFood({ name: '牛奶', place: 'fridge', expireAt: today0() + 8 * DAY_MS })
    const w = mount(FoodView)
    await nextTick()
    expect(w.find('.pct-text').text()).toBe('剩余 100%')
    const minus = () => w.findAll('.op').find((b) => b.attributes('title') === '消耗 25%')
    await minus().trigger('click')
    await nextTick()
    expect(w.find('.pct-text').text()).toBe('剩余 75%')
    await minus().trigger('click')
    await nextTick()
    expect(w.find('.pct-text').text()).toBe('剩余 50%')
    await minus().trigger('click')
    await minus().trigger('click')
    await nextTick()
    // 0% → 自动已消耗，从在库列表消失
    expect(store.state.foodItems[0].status).toBe('consumed')
    expect(w.text()).not.toContain('牛奶')
    w.unmount()
  })
})

describe('食物：页面与表单', () => {
  it('页面按颜色标识展示，提醒条与统计正确', async () => {
    const d = today0()
    store.addFood({ name: '过期食物', category: '蔬菜', place: 'fridge', expireAt: d - DAY_MS })
    store.addFood({ name: '临期食物', category: '奶制品', place: 'fridge', expireAt: d + 2 * DAY_MS })
    store.addFood({ name: '安全食物', category: '零食饼干', place: 'room', expireAt: d + 60 * DAY_MS })
    const w = mount(FoodView)
    await nextTick()
    // 提醒条
    expect(w.text()).toContain('已过期 1 项')
    expect(w.text()).toContain('临期 1 项')
    // 颜色等级
    expect(w.find('.lv-over').exists()).toBe(true)
    expect(w.find('.lv-near').exists()).toBe(true)
    expect(w.find('.lv-ok').exists()).toBe(true)
    // 排序：过期最早在前
    expect(w.findAll('.f-name')[0].text()).toBe('过期食物')
    // 统计卡默认本周
    expect(w.text()).toContain('已消耗')
    expect(w.text()).toContain('在库')
    w.unmount()
  })

  it('标记消耗后从在库列表消失并计入统计', async () => {
    store.addFood({ name: '要吃的', place: 'fridge', expireAt: today0() + 5 * DAY_MS })
    const w = mount(FoodView)
    await nextTick()
    const consumeBtn = w.findAll('.op').find((b) => b.attributes('title') === '标记已消耗')
    await consumeBtn.trigger('click')
    await nextTick()
    expect(store.state.foodItems[0].status).toBe('consumed')
    expect(w.text()).not.toContain('要吃的')
    // 统计 +1
    expect(w.findAll('.stat-num')[0].text()).toBe('1')
    w.unmount()
  })

  it('卡片展示剩余天数与状态色', () => {
    const d = today0()
    const item = store.addFood({ name: '牛奶', category: '奶制品', place: 'fridge', expireAt: d + 2 * DAY_MS })
    const w = mount(FoodCard, { props: { item } })
    expect(w.text()).toContain('奶制品')
    expect(w.text()).toContain('冷藏')
    expect(w.text()).toContain('未开封')
    expect(w.text()).toContain('剩 2 天')
    expect(w.find('.level-chip').classes()).toContain('near')
    w.unmount()
  })

  it('表单：分类/位置/开封变化自动刷新过期时间，手动改后不再覆盖', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 8, 10, 12, 0, 0)) // 2026-09-10
      const w = mount(FoodFormModal, { props: { open: true } })
      await nextTick()
      const panel = () => document.querySelector('.modal-panel')
      const nameInput = [...panel().querySelectorAll('input')].find((i) => i.placeholder.includes('鸡胸肉'))
      nameInput.value = '鸡胸肉'
      nameInput.dispatchEvent(new Event('input'))
      await nextTick()
      // 默认分类“其他 + 冷藏 + 未开封”→ 7 天 → 过期 2026-09-17
      const dateInputs = [...panel().querySelectorAll('input[type="date"]')]
      expect(dateInputs[1].value).toBe('2026-09-17')
      // 改成「肉类」→ 冷藏未开封 2 天
      const select = panel().querySelector('select')
      select.value = '肉类'
      select.dispatchEvent(new Event('change'))
      await nextTick()
      expect([...panel().querySelectorAll('input[type="date"]')][1].value).toBe('2026-09-12')
      // 手动改过期时间 → 之后不再自动覆盖
      const expInput = [...panel().querySelectorAll('input[type="date"]')][1]
      expInput.value = '2026-10-01'
      expInput.dispatchEvent(new Event('change'))
      await nextTick()
      const select2 = panel().querySelector('select')
      select2.value = '饮料'
      select2.dispatchEvent(new Event('change'))
      await nextTick()
      expect([...panel().querySelectorAll('input[type="date"]')][1].value).toBe('2026-10-01')
      expect(panel().textContent).toContain('已手动指定')
      // 保存
      const save = [...panel().querySelectorAll('button')].find((b) => b.textContent.includes('保存'))
      save.click()
      await nextTick()
      const saved = store.state.foodItems[0]
      expect(saved.name).toBe('鸡胸肉')
      expect(saved.category).toBe('饮料')
      expect(saved.expireAt).toBe(new Date(2026, 9, 1).getTime())
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})
