import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../src/App.vue'
import { router } from '../src/router.js'

describe('阶段0→2：框架冒烟', () => {
  it('App 挂载后渲染顶栏与底部导航', async () => {
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } })
    expect(wrapper.find('.topbar-title').text()).toBe('首页')
    expect(wrapper.findAll('.nav-tab')).toHaveLength(5)
    expect(wrapper.find('.page-wrap').exists()).toBe(true)
  })
})
