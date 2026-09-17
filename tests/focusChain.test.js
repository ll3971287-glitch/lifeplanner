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

describe('专注链：设置可编辑并记忆', () => {
  it('保存后文案与预约分钟数写入设置并生效', async () => {
    const w = mountCard()
    await btnByText(w, '设置').trigger('click')
    await nextTick()
    const inputs = [...document.querySelectorAll('.modal-panel input')]
    inputs[0].value = '喝水'
    inputs[0].dispatchEvent(new Event('input'))
    inputs[1].value = '打开文档'
    inputs[1].dispatchEvent(new Event('input'))
    inputs[2].value = '3'
    inputs[2].dispatchEvent(new Event('input'))
    await nextTick()
    const save = [...document.querySelectorAll('.modal-panel button')].find((b) => b.textContent.includes('保存'))
    save.click()
    await nextTick()
    expect(store.state.settings.focusChain.triggerText).toBe('喝水')
    expect(store.state.settings.focusChain.markText).toBe('打开文档')
    expect(store.state.settings.focusChain.reserveMin).toBe(3)
    expect(w.text()).toContain('预约开始（3 分钟）')
    w.unmount()
  })
})
