import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { store, defaultState, normalizeData } from '../src/store.js'
import {
  shopIncome,
  shopSpent,
  shopBalance,
  shopRewardBudgetTotal,
  shopOtherBudgetTotal,
  shopBudgetTotal,
  rewardCoinProgress,
  rewardConditionMet,
  rewardPeriodOk,
  rewardStatus,
} from '../src/selectors.js'
import { rarityMeta, conditionLabel, moneyText, timeHintLabel, TIME_HINTS, ICON_CHOICES } from '../src/rewardMeta.js'
import ShopView from '../src/views/ShopView.vue'
import RewardCard from '../src/components/reward/RewardCard.vue'
import RewardFormModal from '../src/components/reward/RewardFormModal.vue'
import OtherBudgetModal from '../src/components/reward/OtherBudgetModal.vue'
import { settleConfirm, confirmState } from '../src/ui.js'
import { DAY_MS } from '../src/utils/date.js'

beforeEach(() => {
  store._replace(defaultState())
})

afterEach(() => {
  confirmState.visible = false
  confirmState.resolve = null
  document.body.innerHTML = ''
})

function addSessions(minutes) {
  for (const m of minutes) {
    store.addSession({ mode: 'pomodoro', startAt: Date.now() - 3600000, endAt: Date.now(), durationMin: m })
  }
}
function completeTodos(n) {
  for (let i = 0; i < n; i += 1) {
    const t = store.addTodo({ title: `任务${i}` })
    store.toggleTodo(t.id, true)
  }
}

describe('兑换商店：金币产出与余额', () => {
  it('默认费率：专注 1 分钟 1 金币、完成 1 个任务 5 金币', () => {
    addSessions([30, 45])
    completeTodos(2)
    const income = shopIncome(store.state)
    expect(income.focusMin).toBe(75)
    expect(income.todoCount).toBe(2)
    expect(income.coins).toBe(75 + 2 * 5)
    expect(shopBalance(store.state)).toBe(85)
  })

  it('费率可调，且只统计历史累计', () => {
    store.setSetting('shop', { coinPerFocusMin: 2, coinPerTodo: 10 })
    addSessions([10])
    completeTodos(1)
    expect(shopIncome(store.state).coins).toBe(10 * 2 + 1 * 10)
  })

  it('余额 = 累计产出 − 已兑换消耗', () => {
    addSessions([100])
    const r = store.addReward({ name: '奶茶', cost: 30 })
    expect(store.redeemReward(r.id).ok).toBe(true)
    expect(shopSpent(store.state)).toBe(30)
    expect(shopBalance(store.state)).toBe(70)
  })
})

describe('兑换商店：解锁以金币为准 + 时间窗口', () => {
  it('金币够即解锁；不够则锁定并显示还差多少', () => {
    addSessions([50])
    const cheap = store.addReward({ name: '小吃', cost: 20 })
    const pricey = store.addReward({ name: '大餐', cost: 200 })

    expect(rewardCoinProgress(store.state, cheap)).toMatchObject({ current: 50, target: 20, met: true })
    expect(rewardStatus(store.state, cheap)).toMatchObject({ unlocked: true, affordable: true, reason: '' })
    expect(store.redeemReward(cheap.id).ok).toBe(true)

    const st = rewardStatus(store.state, pricey)
    expect(st.unlocked).toBe(false)
    expect(st.affordable).toBe(false)
    expect(st.reason).toBe('金币不足，还差 170')
    expect(store.redeemReward(pricey.id)).toMatchObject({ ok: false, reason: 'coins' })
  })

  it('时间窗口：某日之后 / 某日之前 / 两者都设 / 都不设', () => {
    const now = Date.now()
    const yesterday = now - DAY_MS
    const tomorrow = now + DAY_MS

    expect(rewardPeriodOk({}, now)).toEqual({ ok: true, text: '' })

    const future = { unlockFrom: tomorrow }
    expect(rewardPeriodOk(future, now).ok).toBe(false)
    expect(rewardPeriodOk(future, tomorrow + 1000).ok).toBe(true)

    const past = { unlockUntil: yesterday }
    expect(rewardPeriodOk(past, now).ok).toBe(false)
    expect(rewardPeriodOk(past, yesterday).ok).toBe(true) // 截止日当天仍可兑换

    const both = { unlockFrom: yesterday, unlockUntil: tomorrow }
    const res = rewardPeriodOk(both, now)
    expect(res.ok).toBe(true)
    expect(res.text).toContain('~')
  })

  it('未到时间 / 超期都不会解锁，也不可兑换', () => {
    addSessions([600])
    const future = store.addReward({ name: 'D', cost: 0, unlockFrom: Date.now() + DAY_MS })
    expect(rewardStatus(store.state, future).unlocked).toBe(false)
    expect(rewardStatus(store.state, future).reason).toContain('起可兑换')

    const expired = store.addReward({ name: 'E', cost: 0, unlockUntil: Date.now() - DAY_MS })
    expect(rewardStatus(store.state, expired).reason).toContain('前可兑换')
    expect(store.redeemReward(expired.id)).toMatchObject({ ok: false, reason: 'period' })
  })

  it('额外文字条件（可选）：填写后需手动标记达成才解锁', () => {
    addSessions([100])
    const r = store.addReward({ name: 'C', cost: 0, conditionText: '先完成本周复盘' })
    expect(conditionLabel(r)).toBe('先完成本周复盘')
    expect(rewardConditionMet(r)).toBe(false)
    expect(rewardStatus(store.state, r)).toMatchObject({ unlocked: false, reason: '额外条件未达成' })
    expect(store.redeemReward(r.id)).toMatchObject({ ok: false, reason: 'condition' })

    store.setRewardCustomMet(r.id, true)
    expect(rewardConditionMet(store.state.rewards[0])).toBe(true)
    expect(rewardStatus(store.state, store.state.rewards[0])).toMatchObject({ unlocked: true, condMet: true })
  })

  it('不填额外条件时只看金币（rewardConditionMet 恒为真）', () => {
    expect(rewardConditionMet({ conditionText: '' })).toBe(true)
    expect(rewardConditionMet({})).toBe(true)
    expect(conditionLabel({ conditionText: '' })).toBe('')
  })
})

describe('兑换商店：增删改与兑换', () => {
  it('新增保存全部字段（含图标 / 稀有度 / 预估预算 / 预估价位 / 大致时间 / 预览 / 日期）', () => {
    const from = Date.now()
    const r = store.addReward({
      name: '看一场电影',
      icon: '🎬',
      desc: '周末去影院',
      cost: 120,
      budget: 80,
      rarity: 'epic',
      priceTier: '¥80 左右',
      timeHint: 'halfYear',
      previewImage: 'https://example.com/a.jpg',
      previewNote: '周六晚场',
      conditionText: '先完成本周复盘',
      unlockFrom: from,
    })
    expect(r.id).toBeTruthy()
    expect(r).toMatchObject({
      name: '看一场电影',
      icon: '🎬',
      desc: '周末去影院',
      cost: 120,
      budget: 80,
      rarity: 'epic',
      priceTier: '¥80 左右',
      timeHint: 'halfYear',
      previewImage: 'https://example.com/a.jpg',
      previewNote: '周六晚场',
      conditionText: '先完成本周复盘',
      customMet: false,
      redeemed: false,
      redeemedAt: null,
    })
    expect(r.unlockFrom).toBe(from)
    expect(store.state.rewards).toHaveLength(1)
  })

  it('编辑与删除目标', () => {
    const r = store.addReward({ name: '旧名', cost: 10 })
    store.updateReward(r.id, { name: '新名', cost: 99, budget: 1288, rarity: 'legend', priceTier: '¥200 档', timeHint: 'year' })
    const updated = store.state.rewards[0]
    expect(updated.name).toBe('新名')
    expect(updated.cost).toBe(99)
    expect(updated.budget).toBe(1288)
    expect(updated.priceTier).toBe('¥200 档')
    expect(timeHintLabel(updated.timeHint)).toBe('1 年后')
    expect(rarityMeta(updated.rarity).label).toBe('传说')
    store.deleteReward(r.id)
    expect(store.state.rewards).toHaveLength(0)
  })

  it('兑换成功后：标记已兑换、写入流水、扣减余额；重复兑换被拒', () => {
    addSessions([100])
    completeTodos(2) // 100 + 10 = 110 金币
    const r = store.addReward({ name: '奶茶', cost: 30 })
    const res = store.redeemReward(r.id)
    expect(res.ok).toBe(true)

    const saved = store.state.rewards[0]
    expect(saved.redeemed).toBe(true)
    expect(saved.redeemedAt).toBeTruthy()

    const log = store.state.rewardRedemptions
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ rewardId: r.id, name: '奶茶', cost: 30 })
    expect(shopBalance(store.state)).toBe(80)

    // 一次性：再次兑换被拒且不写流水
    const again = store.redeemReward(r.id)
    expect(again).toMatchObject({ ok: false, reason: 'redeemed' })
    expect(store.state.rewardRedemptions).toHaveLength(1)
    expect(shopBalance(store.state)).toBe(80)
  })

  it('金币不足 / 额外条件未达成时不可兑换，且余额不变', () => {
    addSessions([60])
    const pricey = store.addReward({ name: '大礼', cost: 500 })
    const res = store.redeemReward(pricey.id)
    expect(res).toMatchObject({ ok: false, reason: 'coins' })
    expect(res.text).toContain('还差 440')
    expect(store.state.rewardRedemptions).toHaveLength(0)
    expect(shopBalance(store.state)).toBe(60)

    const gated = store.addReward({ name: '条件奖励', cost: 10, conditionText: '先做完复盘' })
    expect(store.redeemReward(gated.id)).toMatchObject({ ok: false, reason: 'condition' })
    expect(store.state.rewardRedemptions).toHaveLength(0)
  })

  it('不存在的奖励兑换返回 not-found', () => {
    expect(store.redeemReward('nope')).toMatchObject({ ok: false, reason: 'not-found' })
  })
})

describe('兑换商店：预估预算', () => {
  it('预估预算为手动输入的数字，负数/非数字归零，不参与解锁判定', () => {
    const r = store.addReward({ name: '耳机', cost: 100, budget: 899 })
    expect(r.budget).toBe(899)
    store.updateReward(r.id, { budget: -5 })
    expect(store.state.rewards[0].budget).toBe(0)
    store.updateReward(r.id, { budget: 'abc' })
    expect(store.state.rewards[0].budget).toBe(0)

    // 预算不影响解锁：预算再高，金币不够仍锁定；金币够了就能兑换
    store.updateReward(r.id, { budget: 99999 })
    expect(rewardStatus(store.state, store.state.rewards[0]).unlocked).toBe(false)
    expect(rewardStatus(store.state, store.state.rewards[0]).reason).toContain('金币不足')
    addSessions([100])
    expect(rewardStatus(store.state, store.state.rewards[0]).unlocked).toBe(true)
  })

  it('预估预算合计 = 奖励金额 + 其他预算金额', () => {
    store.addReward({ name: 'A', cost: 0, budget: 100 })
    store.addReward({ name: 'B', cost: 0, budget: 250.5 })
    store.addReward({ name: 'C', cost: 0 })
    store.addOtherBudget({ name: '房租', amount: 1500, note: '每月固定' })
    store.addOtherBudget({ name: '通勤', amount: 200 })
    expect(shopRewardBudgetTotal(store.state)).toBe(350.5)
    expect(shopOtherBudgetTotal(store.state)).toBe(1700)
    expect(shopBudgetTotal(store.state)).toBe(2050.5)
    expect(moneyText(350.5)).toBe('¥350.50')
    expect(moneyText(1288)).toBe('¥1,288')
  })

  it('其他预算可增删改，金额负数/非数字归零', () => {
    const o = store.addOtherBudget({ name: '日用采购', amount: 320, note: '每周一次' })
    expect(o).toMatchObject({ name: '日用采购', amount: 320, note: '每周一次' })
    store.updateOtherBudget(o.id, { name: '日用采购（调整）', amount: 400 })
    expect(store.state.otherBudgets[0]).toMatchObject({ name: '日用采购（调整）', amount: 400 })
    store.updateOtherBudget(o.id, { amount: -10 })
    expect(store.state.otherBudgets[0].amount).toBe(0)
    store.deleteOtherBudget(o.id)
    expect(store.state.otherBudgets).toHaveLength(0)
  })

  it('商店顶部展示预估预算合计（奖励 + 其他），卡片展示每条奖励的预算', async () => {
    store.addReward({ name: '耳机', cost: 100, budget: 899 })
    store.addReward({ name: '键盘', cost: 50, budget: 1288 })
    store.addOtherBudget({ name: '房租', amount: 1500 })
    const w = mount(ShopView)
    await nextTick()
    const line = w.find('.wallet-budget')
    expect(line.exists()).toBe(true)
    expect(line.text()).toContain('预估预算合计')
    expect(line.text()).toContain('¥3,687')
    expect(line.text()).toContain('奖励 ¥2,187')
    expect(line.text()).toContain('其他 ¥1,500')
    const card = w.findAll('.reward-card')[0]
    expect(card.find('.info-chip.budget').text()).toBe('预估预算：¥899')
    w.unmount()
  })

  it('其他预算单独一栏：展示条目与小计，可新增、编辑、删除', async () => {
    store.addOtherBudget({ name: '房租', amount: 1500, note: '每月固定', timeHint: 'quarter' })
    const w = mount(ShopView)
    await nextTick()
    const sec = w.find('.other-budget')
    expect(sec.exists()).toBe(true)
    expect(sec.text()).toContain('其他预算')
    expect(sec.text()).toContain('小计 ¥1,500')
    expect(sec.find('.ob-row').text()).toContain('房租')
    expect(sec.find('.ob-row').text()).toContain('大致时间：一季度后')
    expect(sec.find('.ob-row').text()).toContain('每月固定')

    // 新增
    await sec.findAll('button').find((b) => b.text().includes('新增')).trigger('click')
    await nextTick()
    const panel = document.body.querySelector('.modal-panel')
    expect(panel).toBeTruthy()
    const nameInput = panel.querySelector('input')
    nameInput.value = '通勤'
    nameInput.dispatchEvent(new Event('input'))
    const amountInput = panel.querySelector('input[type="number"]')
    amountInput.value = '200'
    amountInput.dispatchEvent(new Event('input'))
    await nextTick()
    ;[...panel.querySelectorAll('button')].find((b) => b.textContent.includes('保存')).click()
    await nextTick()
    expect(store.state.otherBudgets).toHaveLength(2)
    expect(w.find('.other-budget').text()).toContain('小计 ¥1,700')

    // 删除（确认后生效）
    const row = w.findAll('.ob-row').find((r) => r.text().includes('通勤'))
    await row.find('.mini-btn.danger').trigger('click')
    await nextTick()
    settleConfirm(true)
    await new Promise((r) => setTimeout(r, 10))
    expect(store.state.otherBudgets).toHaveLength(1)
    expect(w.find('.other-budget').text()).not.toContain('通勤')
    w.unmount()
  })

  it('其他预算弹层保存字段并在编辑时回显', async () => {
    const w = mount(OtherBudgetModal, { props: { open: true } })
    await nextTick()
    const panel = document.body.querySelector('.modal-panel')
    const nameInput = panel.querySelector('input')
    nameInput.value = '水电燃气'
    nameInput.dispatchEvent(new Event('input'))
    const amountInput = panel.querySelector('input[type="number"]')
    amountInput.value = '480'
    amountInput.dispatchEvent(new Event('input'))
    // 大致时间预估：1 年后
    ;[...panel.querySelectorAll('.seg-item')].find((s) => s.textContent === '1 年后').click()
    await nextTick()
    ;[...panel.querySelectorAll('button')].find((b) => b.textContent.includes('保存')).click()
    await nextTick()
    expect(store.state.otherBudgets[0]).toMatchObject({ name: '水电燃气', amount: 480, timeHint: 'year' })
    w.unmount()

    document.body.innerHTML = ''
    const w2 = mount(OtherBudgetModal, { props: { open: true, item: store.state.otherBudgets[0] } })
    await nextTick()
    const panel2 = document.body.querySelector('.modal-panel')
    expect(panel2.querySelector('input').value).toBe('水电燃气')
    expect(panel2.querySelector('input[type="number"]').value).toBe('480')
    expect([...panel2.querySelectorAll('.seg-item')].find((s) => s.textContent === '1 年后').classList.contains('active')).toBe(true)
    w2.unmount()
  })
})

describe('兑换商店：本地存储与导入导出', () => {
  it('normalizeData 保留 rewards / rewardRedemptions（刷新不丢数据）', () => {
    const raw = {
      todos: [],
      rewards: [{ id: 'r1', name: '奖励', cost: 5 }],
      rewardRedemptions: [{ id: 'l1', rewardId: 'r1', name: '奖励', cost: 5, at: 1 }],
      otherBudgets: [{ id: 'o1', name: '房租', amount: 1500 }],
    }
    const out = normalizeData(raw)
    expect(out.rewards).toHaveLength(1)
    expect(out.rewardRedemptions).toHaveLength(1)
    expect(out.otherBudgets).toHaveLength(1)
    // 旧数据没有 shop 设置时使用默认费率
    expect(out.settings.shop).toEqual({ coinPerFocusMin: 1, coinPerTodo: 5 })
  })

  it('大致时间预估只接受预设模糊时间段，非法值忽略', () => {
    expect(TIME_HINTS.map((t) => t.label)).toEqual(['一季度后', '半年后', '1 年后', '若干年后'])
    const r = store.addReward({ name: 'A', cost: 0, timeHint: 'quarter' })
    expect(r.timeHint).toBe('quarter')
    expect(timeHintLabel(r.timeHint)).toBe('一季度后')
    store.updateReward(r.id, { timeHint: '随便写的日期' })
    expect(store.state.rewards[0].timeHint).toBe('')
    // 不选 = 不限
    expect(store.addReward({ name: 'B', cost: 0 }).timeHint).toBe('')
  })

  it('其他预算也可设大致时间预估', () => {
    const o = store.addOtherBudget({ name: '换电脑', amount: 8000, timeHint: 'years' })
    expect(o.timeHint).toBe('years')
    store.updateOtherBudget(o.id, { timeHint: 'quarter' })
    expect(store.state.otherBudgets[0].timeHint).toBe('quarter')
    store.updateOtherBudget(o.id, { timeHint: 'nonsense' })
    expect(store.state.otherBudgets[0].timeHint).toBe('')
  })

  it('导出导入往返不丢其他预算', async () => {
    store.addOtherBudget({ name: '房租', amount: 1500, note: '每月固定' })
    const exported = store.exportData()
    expect(exported.otherBudgets).toHaveLength(1)

    store._replace(defaultState())
    const missing = await store.importData(exported)
    expect(missing).toEqual([])
    expect(store.state.otherBudgets).toHaveLength(1)
    expect(store.state.otherBudgets[0]).toMatchObject({ name: '房租', amount: 1500 })
  })

  it('导出导入往返不丢奖励与兑换流水', async () => {
    addSessions([10]) // 产出 10 金币，足够兑换
    const r = store.addReward({ name: '奖励X', cost: 5 })
    store.redeemReward(r.id)
    const exported = store.exportData()
    expect(exported.rewards).toHaveLength(1)
    expect(exported.rewardRedemptions).toHaveLength(1)

    store._replace(defaultState())
    expect(store.state.rewards).toHaveLength(0)
    const missing = await store.importData(exported)
    expect(missing).toEqual([])
    expect(store.state.rewards).toHaveLength(1)
    expect(store.state.rewardRedemptions).toHaveLength(1)
    expect(store.state.rewards[0].name).toBe('奖励X')
  })
})

describe('兑换商店：界面', () => {
  it('商店顶部显示金币余额与累计产出明细，标签带数量', async () => {
    addSessions([100])
    completeTodos(2) // 110 金币
    store.addReward({ name: '买得起的奖励', cost: 10 })
    store.addReward({ name: '还买不起的奖励', cost: 9999 })
    const w = mount(ShopView)
    await nextTick()
    expect(w.find('.coin-num').text()).toBe('110')
    expect(w.text()).toContain('专注 100 分钟')
    expect(w.text()).toContain('完成任务 2 个')
    const labels = w.findAll('.seg-item').map((s) => s.text())
    expect(labels).toContain('全部（2）')
    expect(labels).toContain('可兑换（1）')
    expect(labels).toContain('未解锁（1）')
    expect(labels).toContain('已兑换（0）')
    w.unmount()
  })

  it('金币够的卡片可兑换并扣减金币；不够的按钮禁用并给出原因', async () => {
    addSessions([50])
    store.addReward({ name: '电影票', cost: 20 })
    store.addReward({ name: '大餐', cost: 500 })
    const w = mount(ShopView)
    await nextTick()

    const cards = w.findAll('.reward-card')
    const okCard = cards.find((c) => c.text().includes('电影票'))
    const lockedCard = cards.find((c) => c.text().includes('大餐'))
    expect(okCard.find('.btn').text()).toBe('兑换')
    expect(okCard.find('.btn').attributes('disabled')).toBeUndefined()
    expect(lockedCard.find('.btn').text()).toBe('金币不足')
    expect(lockedCard.find('.btn').attributes('disabled')).toBeDefined()
    expect(lockedCard.find('.reason').text()).toBe('金币不足，还差 450')

    await okCard.find('.btn').trigger('click')
    await nextTick()
    expect(store.state.rewards[0].redeemed).toBe(true)
    expect(store.state.rewardRedemptions).toHaveLength(1)
    expect(w.find('.coin-num').text()).toBe('30')
    w.unmount()
  })

  it('卡片展示金币进度、预估价位与大致时间', async () => {
    addSessions([40])
    store.addReward({ name: '耳机', cost: 100, priceTier: '¥800 档', timeHint: 'halfYear' })
    const w = mount(RewardCard, { props: { reward: store.state.rewards[0] } })
    const text = w.text()
    expect(text).toContain('金币进度')
    expect(text).toContain('40 / 100 金币')
    expect(text).toContain('预估价位：¥800 档')
    expect(text).toContain('大致时间：半年后')
    w.unmount()
  })

  it('额外条件卡片显示条件与手动标记入口，标记后变为可兑换', async () => {
    addSessions([100])
    store.addReward({ name: '早起奖励', cost: 0, conditionText: '连续早起一周' })
    const w = mount(ShopView)
    await nextTick()
    expect(w.text()).toContain('额外条件：连续早起一周')
    expect(w.text()).toContain('条件未达成')
    const mark = w.findAll('button').find((b) => b.text().includes('手动标记为已达成'))
    expect(mark).toBeTruthy()
    await mark.trigger('click')
    expect(store.state.rewards[0].customMet).toBe(true)
    await nextTick()
    expect(w.text()).toContain('可兑换')
    expect(w.find('.reward-card .reason').exists()).toBe(false)
    w.unmount()
  })

  it('表单可保存全部字段并在编辑时回显', async () => {
    const w = mount(RewardFormModal, { props: { open: true } })
    await nextTick()
    const panel = document.body.querySelector('.modal-panel')
    expect(panel).toBeTruthy()
    const nameInput = panel.querySelector('input')
    nameInput.value = '自助餐'
    nameInput.dispatchEvent(new Event('input'))
    // 预估预算（数字）
    const budgetInput = [...panel.querySelectorAll('input[type="number"]')].find((i) => i.placeholder.includes('120'))
    expect(budgetInput).toBeTruthy()
    budgetInput.value = '268'
    budgetInput.dispatchEvent(new Event('input'))
    // 大致时间预估（选「半年后」）
    const timeSeg = [...panel.querySelectorAll('.seg-item')].find((s) => s.textContent === '半年后')
    expect(timeSeg).toBeTruthy()
    timeSeg.click()
    await nextTick()
    // 预估价位（文字）
    const texts = [...panel.querySelectorAll('input')].filter((i) => i.placeholder.includes('¥'))
    expect(texts).toHaveLength(1)
    texts[0].value = '¥300 档'
    texts[0].dispatchEvent(new Event('input'))
    await nextTick()
    const saveBtn = [...panel.querySelectorAll('button')].find((b) => b.textContent.includes('保存'))
    saveBtn.click()
    await nextTick()
    expect(store.state.rewards).toHaveLength(1)
    expect(store.state.rewards[0]).toMatchObject({ name: '自助餐', budget: 268, priceTier: '¥300 档', timeHint: 'halfYear' })
    expect(store.state.rewards[0].icon).toBe(ICON_CHOICES[0])
    w.unmount()

    document.body.innerHTML = ''
    const w2 = mount(RewardFormModal, { props: { open: true, reward: store.state.rewards[0] } })
    await nextTick()
    const panel2 = document.body.querySelector('.modal-panel')
    expect(panel2.querySelector('input').value).toBe('自助餐')
    expect([...panel2.querySelectorAll('input')].some((i) => i.value === '¥300 档')).toBe(true)
    expect([...panel2.querySelectorAll('.seg-item')].find((s) => s.textContent === '半年后').classList.contains('active')).toBe(true)
    w2.unmount()
  })
})
