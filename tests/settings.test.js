import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import SettingsView from '../src/views/SettingsView.vue'
import ConfirmDialog from '../src/components/ui/ConfirmDialog.vue'
import { settleConfirm, confirmState } from '../src/ui.js'

beforeEach(() => {
  store._replace(defaultState())
  // jsdom 无 createObjectURL
  URL.createObjectURL = () => 'blob:fake-url'
  URL.revokeObjectURL = () => {}
})

afterEach(() => {
  confirmState.visible = false
  confirmState.resolve = null
  document.body.innerHTML = ''
})

function mountView() {
  return mount(SettingsView)
}

describe('设置页', () => {
  it('展示 3 套主题并支持切换，全局 CSS 变量联动', async () => {
    const w = mountView()
    expect(w.findAll('.theme-card')).toHaveLength(3)
    expect(w.findAll('.theme-card')[0].classes()).toContain('on')
    await w.findAll('.theme-card')[1].trigger('click')
    expect(store.state.settings.theme).toBe('fog')
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#E3EBF2')
    await nextTick()
    expect(w.findAll('.theme-card')[1].classes()).toContain('on')
    w.unmount()
  })

  it('明暗模式一键切换', async () => {
    const w = mountView()
    const segs = w.findAll('.seg-item')
    await segs.find((b) => b.text().includes('深色')).trigger('click')
    expect(store.state.settings.mode).toBe('dark')
    expect(document.documentElement.dataset.mode).toBe('dark')
    await segs.find((b) => b.text().includes('浅色')).trigger('click')
    expect(document.documentElement.dataset.mode).toBe('light')
    w.unmount()
  })

  it('修改休息时长与每日目标并保存（番茄时长已移到专注页）', async () => {
    const w = mountView()
    // 设置页不再有「番茄专注时长」输入
    expect(w.text()).not.toContain('番茄专注时长（分钟）')
    expect(w.text()).toContain('已移到「专注」页')
    const inputs = w.findAll('input[type="number"]')
    await inputs[0].setValue('10') // 短休息
    await inputs[0].trigger('change')
    await inputs[1].setValue('150') // 每日目标
    await inputs[1].trigger('change')
    expect(store.state.settings.pomodoroBreakMin).toBe(10)
    expect(store.state.settings.dailyFocusGoalMin).toBe(150)
    expect(store.state.settings.pomodoroFocusMin).toBe(25) // 保持不变
    w.unmount()
  })

  it('首页内容开关控制项目进度在首页的显示', async () => {
    const w = mountView()
    expect(w.text()).toContain('首页内容')
    const sw = w.find('.opt-row .switch')
    await sw.trigger('click')
    expect(store.state.settings.showProjectsOnHome).toBe(false)
    await sw.trigger('click')
    expect(store.state.settings.showProjectsOnHome).toBe(true)
    w.unmount()
  })

  it('导出按钮触发下载流程不报错', async () => {
    store.addTodo({ title: '待备份' })
    const w = mountView()
    const exportBtn = w.findAll('button').find((b) => b.text().includes('导出全部数据'))
    await exportBtn.trigger('click')
    // 不抛错即为通过（jsdom 下载流程已 stub）
    w.unmount()
  })

  it('导入备份覆盖当前数据', async () => {
    store.addTodo({ title: '旧数据' })
    const backup = JSON.stringify({ ...defaultState(), todos: [{ id: 'imp1', title: '导入的任务', timeType: 'none' }] })
    const file = new File([backup], 'backup.json', { type: 'application/json' })
    const w = mountView()
    const input = w.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await new Promise((r) => setTimeout(r, 300))
    expect(store.state.todos).toHaveLength(1)
    expect(store.state.todos[0].title).toBe('导入的任务')
    w.unmount()
  })

  it('导入非法文件提示错误且数据不变', async () => {
    store.addTodo({ title: '保留数据' })
    const file = new File(['{"not":"valid"}'], 'bad.json', { type: 'application/json' })
    const w = mountView()
    const input = w.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await new Promise((r) => setTimeout(r, 300))
    expect(store.state.todos).toHaveLength(1)
    w.unmount()
  })

  it('清空数据需要输入确认词并二次确认', async () => {
    store.addTodo({ title: '将被清空' })
    mount(ConfirmDialog)
    const w = mountView()
    const clearBtn = w.findAll('button').find((b) => b.text().includes('清空全部数据'))
    await clearBtn.trigger('click')
    await nextTick()
    const panel = document.body.querySelector('.modal-panel')
    expect(panel).toBeTruthy()
    const dangerBtn = panel.querySelector('.btn-danger')
    expect(dangerBtn.disabled).toBe(true)
    const wordInput = panel.querySelector('input.input')
    wordInput.value = '不对'
    wordInput.dispatchEvent(new Event('input'))
    await nextTick()
    expect(dangerBtn.disabled).toBe(true)
    wordInput.value = '清空'
    wordInput.dispatchEvent(new Event('input'))
    await nextTick()
    expect(dangerBtn.disabled).toBe(false)
    dangerBtn.click()
    await nextTick()
    expect(document.body.textContent).toContain('即将清空全部数据')
    settleConfirm(true)
    await new Promise((r) => setTimeout(r, 20))
    expect(store.state.todos).toHaveLength(0)
    expect(document.body.querySelector('.modal-panel')).toBeNull()
    w.unmount()
  })
})
