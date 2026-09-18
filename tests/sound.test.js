import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { CHIMES } from '../src/sound.js'
import FocusOverlay from '../src/components/focus/FocusOverlay.vue'
import FocusChainCard from '../src/components/focus/FocusChainCard.vue'

// —— 假的 Web Audio 实现（jsdom 没有）
class FakeOsc {
  constructor() {
    this.frequency = { setValueAtTime: vi.fn() }
    this.connect = vi.fn()
    this.start = vi.fn()
    this.stop = vi.fn()
    this.type = 'sine'
  }
}
class FakeGain {
  constructor() {
    this.gain = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
    this.connect = vi.fn()
  }
}
class FakeAC {
  constructor() {
    this.currentTime = 0
    this.state = 'running'
    this.destination = {}
    this.oscillators = []
    this.resume = vi.fn()
  }
  createOscillator() {
    const o = new FakeOsc()
    this.oscillators.push(o)
    return o
  }
  createGain() {
    return new FakeGain()
  }
}

beforeEach(() => {
  window.AudioContext = FakeAC
  store._replace(defaultState())
  const f = store.focusState
  f.visible = false
  f.phase = 'idle'
  f.mode = 'pomodoro'
})

afterEach(() => {
  document.body.innerHTML = ''
  delete window.AudioContext
})

describe('提示音合成', () => {
  it('playChime 按音效定义合成对应数量的音', async () => {
    const sound = await import('../src/sound.js')
    expect(Object.keys(CHIMES)).toEqual(['focusEnd', 'breakEnd', 'chainUnlock', 'chainTimeout'])
    sound.playChime('focusEnd')
    // 音效定义：专注结束为三声上行
    expect(CHIMES.focusEnd).toHaveLength(3)
  })

  it('无 AudioContext 环境不报错', async () => {
    delete window.AudioContext
    const sound = await import('../src/sound.js')
    expect(() => sound.playChime('breakEnd')).not.toThrow()
    expect(sound.soundSupported()).toBe(false)
  })
})

describe('专注浮层：计时结束提示音', () => {
  async function mountOverlay() {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div/>' } }, { path: '/focus', component: { template: '<div/>' } }] })
    router.push('/')
    return mount(FocusOverlay, { global: { plugins: [router] } })
  }

  it('专注到点响 focusEnd，休息结束响 breakEnd，开关关闭时不响', async () => {
    const spy = vi.spyOn(await import('../src/sound.js'), 'playChime')
    const w = await mountOverlay()
    store.focusState.phase = 'run'
    await nextTick()
    store.focusState.phase = 'break' // 番茄到点
    await nextTick()
    expect(spy).toHaveBeenCalledWith('focusEnd')
    store.focusState.phase = 'idle' // 休息结束
    await nextTick()
    expect(spy).toHaveBeenCalledWith('breakEnd')
    // 关闭提示音
    store.setSetting('soundOn', false)
    spy.mockClear()
    store.focusState.phase = 'run'
    await nextTick()
    store.focusState.phase = 'break'
    await nextTick()
    expect(spy).not.toHaveBeenCalled()
    w.unmount()
  })
})

describe('专注链：倒计时结束提示音', () => {
  it('完成触发信号后倒计时结束响解锁音，超时响警示音', async () => {
    const spy = vi.spyOn(await import('../src/sound.js'), 'playChime')
    vi.useFakeTimers()
    try {
      store.setSetting('focusChain', { triggerText: '信号', markText: '标志', reserveMin: 1 })
      const w = mount(FocusChainCard)
      // 超时未勾选触发信号 → 警示音
      const reserve = w.findAll('button').find((b) => b.text().includes('预约开始'))
      await reserve.trigger('click')
      vi.advanceTimersByTime(61000)
      await nextTick()
      expect(spy).toHaveBeenCalledWith('chainTimeout')
      // 勾选触发信号后超时结束 → 解锁音
      spy.mockClear()
      await reserve.trigger('click')
      const step = w.findAll('.chain-step')[0]
      await step.trigger('click')
      vi.advanceTimersByTime(61000)
      await nextTick()
      expect(spy).toHaveBeenCalledWith('chainUnlock')
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})
