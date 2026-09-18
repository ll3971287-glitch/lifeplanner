import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import FocusChainCard from '../src/components/focus/FocusChainCard.vue'

beforeEach(() => {
  store._replace(defaultState())
  const f = store.focusState
  f.visible = false
  f.phase = 'idle'
  f.mode = 'pomodoro'
})

afterEach(() => {
  document.body.innerHTML = ''
})

function mountCard() {
  return mount(FocusChainCard)
}

const btnByText = (w, text) => w.findAll("button").find((b) => b.text().includes(text))
const step = (w, i) => w.findAll('.chain-step')[i]

describe('专注链：状态锁与执行顺序', () => {
  it('初始状态：两张卡都锁定、立即专注禁用', () => {
    const w = mountCard()
    expect(step(w, 0).classes()).toContain('locked')
    expect(step(w, 1).classes()).toContain('locked')
    expect(btnByText(w, '立即专注').attributes('disabled')).toBeDefined()
    expect(btnByText(w, '预约开始').attributes('disabled')).toBeUndefined()
    w.unmount()
  })

  it('倒计时运行中：仅触发信号可勾选，专注标志与立即专注不可用', async () => {
    vi.useFakeTimers()
    try {
      const w = mountCard()
      await btnByText(w, '预约开始').trigger('click')
      await nextTick()
      // 触发信号可点并高亮
      await step(w, 0).trigger('click')
      expect(step(w, 0).classes()).toContain('done')
      // 专注标志仍锁定，点了也没反应
      await step(w, 1).trigger('click')
      expect(step(w, 1).classes()).not.toContain('done')
      expect(step(w, 1).classes()).toContain('locked')
      expect(btnByText(w, '立即专注').attributes('disabled')).toBeDefined()
      // 倒计时显示
      expect(w.text()).toContain('预约倒计时')
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('倒计时结束且触发信号已完成 → 解锁专注标志；勾选后解锁立即专注', async () => {
    vi.useFakeTimers()
    try {
      store.setSetting('focusChain', { triggerText: '信号', markText: '标志', reserveMin: 1 })
      const w = mountCard()
      await btnByText(w, '预约开始').trigger('click')
      await step(w, 0).trigger('click')
      vi.advanceTimersByTime(60000) // 一分钟倒计时走完
      vi.advanceTimersByTime(1000)
      await nextTick()
      expect(step(w, 1).classes()).toContain('active')
      await step(w, 1).trigger('click')
      expect(step(w, 1).classes()).toContain('done')
      expect(btnByText(w, '立即专注').attributes('disabled')).toBeUndefined()
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('超时未完成触发信号 → 本轮重置回初始态', async () => {
    vi.useFakeTimers()
    try {
      store.setSetting('focusChain', { triggerText: '信号', markText: '标志', reserveMin: 1 })
      const w = mountCard()
      await btnByText(w, '预约开始').trigger('click')
      vi.advanceTimersByTime(61000)
      await nextTick()
      expect(w.text()).toContain('专注链已重置')
      expect(step(w, 0).classes()).toContain('locked')
      expect(btnByText(w, '预约开始').attributes('disabled')).toBeUndefined()
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('点击立即专注：发出 start 事件并重置链', async () => {
    vi.useFakeTimers()
    try {
      store.setSetting('focusChain', { triggerText: '信号', markText: '标志', reserveMin: 1 })
      const w = mountCard()
      await btnByText(w, '预约开始').trigger('click')
      await step(w, 0).trigger('click')
      vi.advanceTimersByTime(61000)
      await nextTick()
      await step(w, 1).trigger('click')
      await btnByText(w, '立即专注').trigger('click')
      expect(w.emitted('start')).toBeTruthy()
      expect(step(w, 0).classes()).toContain('locked')
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('离开页面（卸载）后进度清零', async () => {
    vi.useFakeTimers()
    try {
      store.setSetting('focusChain', { triggerText: '信号', markText: '标志', reserveMin: 1 })
      const w = mountCard()
      await btnByText(w, '预约开始').trigger('click')
      await step(w, 0).trigger('click')
      w.unmount()
      const w2 = mountCard()
      await nextTick()
      expect(step(w2, 0).classes()).toContain('locked')
      expect(w2.text()).not.toContain('预约倒计时')
      w2.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('专注链：触发信号 / 专注标志的多条预设', () => {
  const fc = () => store.state.settings.focusChain
  const lastPanel = () => {
    const panels = [...document.querySelectorAll('.modal-panel')]
    return panels[panels.length - 1]
  }

  it('默认带多条预选，可点选切换，卡片文案随之变化', async () => {
    const w = mountCard()
    await nextTick()
    expect(fc().triggers.length).toBeGreaterThanOrEqual(3)
    expect(fc().marks.length).toBeGreaterThanOrEqual(3)
    expect(w.text()).toContain(fc().triggers[0])
    await w.findAll('.swap-btn')[0].trigger('click') // 触发信号预设
    await nextTick()
    const items = [...lastPanel().querySelectorAll('.preset-item')]
    expect(items.length).toBe(fc().triggers.length)
    items[1].querySelector('.preset-pick').click()
    await nextTick()
    expect(fc().triggerIndex).toBe(1)
    expect(w.text()).toContain(fc().triggers[1])
    w.unmount()
  })

  it('可新增自定义预设并自动切换使用', async () => {
    const w = mountCard()
    await w.findAll('.swap-btn')[0].trigger('click')
    await nextTick()
    const input = [...lastPanel().querySelectorAll('input')].find((i) => i.placeholder.includes('新增预设'))
    input.value = '自定义触发信号'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    const addBtn = [...lastPanel().querySelectorAll('button')].find((b) => b.textContent.includes('添加'))
    addBtn.click()
    await nextTick()
    expect(fc().triggers).toContain('自定义触发信号')
    expect(fc().triggers[fc().triggerIndex]).toBe('自定义触发信号')
    expect(w.text()).toContain('自定义触发信号')
    w.unmount()
  })

  it('可编辑与删除预设，删除当前项后索引自动回退', async () => {
    const w = mountCard()
    await w.findAll('.swap-btn')[0].trigger('click')
    await nextTick()
    // 先切到第 2 条，再删除它 → 索引回退到第 1 条
    const items = [...lastPanel().querySelectorAll('.preset-item')]
    items[1].querySelector('.preset-pick').click()
    await nextTick()
    const items2 = [...lastPanel().querySelectorAll('.preset-item')]
    const deletedText = fc().triggers[1]
    items2[1].querySelectorAll('.mini-btn')[1].click() // 删除
    await nextTick()
    expect(fc().triggers).not.toContain(deletedText)
    expect(fc().triggerIndex).toBe(0)
    // 编辑第 0 条
    const items3 = [...lastPanel().querySelectorAll('.preset-item')]
    items3[0].querySelectorAll('.mini-btn')[0].click()
    await nextTick()
    const editInput = lastPanel().querySelector('input')
    editInput.value = '改过的触发信号'
    editInput.dispatchEvent(new Event('input'))
    await nextTick()
    const saveBtn = [...lastPanel().querySelectorAll('button')].find((b) => b.textContent.includes('保存'))
    saveBtn.click()
    await nextTick()
    expect(fc().triggers[0]).toBe('改过的触发信号')
    w.unmount()
  })

  it('预约倒计时分钟数仍可在设置里修改', async () => {
    const w = mountCard()
    const settingBtn = w.findAll('button').find((b) => b.text().includes('设置'))
    await settingBtn.trigger('click')
    await nextTick()
    const input = lastPanel().querySelector('input')
    input.value = '3'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    const saveBtn = [...lastPanel().querySelectorAll('button')].find((b) => b.textContent.includes('保存'))
    saveBtn.click()
    await nextTick()
    expect(fc().reserveMin).toBe(3)
    expect(w.text()).toContain('预约开始（3 分钟）')
    w.unmount()
  })
})
