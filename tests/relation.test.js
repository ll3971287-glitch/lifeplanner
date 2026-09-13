import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { daysUntilBirthday, ageOf, compareByBirthday, isLeapYear } from '../src/relationMeta.js'
import RelationsView from '../src/views/RelationsView.vue'
import HomeView from '../src/views/HomeView.vue'

beforeEach(() => {
  store._replace(defaultState())
  const f = store.focusState
  f.visible = false
  f.phase = 'idle'
})

afterEach(() => {
  document.body.innerHTML = ''
})

// 构造“距今天 n 天后的生日”月日，避免写死日期
function birthdayInDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return { birthMonth: d.getMonth() + 1, birthDay: d.getDate() }
}

describe('生日计算', () => {
  it('daysUntilBirthday：今天 0 天、明天 1 天、昨天算明年', () => {
    const today = new Date()
    const tomorrow = new Date(Date.now() + 86400000)
    const yesterday = new Date(Date.now() - 86400000)
    expect(daysUntilBirthday(today.getMonth() + 1, today.getDate())).toBe(0)
    expect(daysUntilBirthday(tomorrow.getMonth() + 1, tomorrow.getDate())).toBe(1)
    const back = daysUntilBirthday(yesterday.getMonth() + 1, yesterday.getDate())
    expect(back).toBeGreaterThan(300) // 已过 → 明年
    expect(daysUntilBirthday(null, null)).toBeNull()
  })

  it('2/29 在平年按 2/28 计', () => {
    const flat = isLeapYear(2027) ? 2028 : 2027 // 找一个平年
    const leapDay = new Date(flat, 1, 28).getTime()
    const days = daysUntilBirthday(2, 29, leapDay)
    expect(days).toBe(0) // 平年 2/28 视为生日当天
  })

  it('ageOf：未过生日减一岁', () => {
    const now = new Date()
    const nextMonth = { m: now.getMonth() + 2 <= 12 ? now.getMonth() + 2 : 1 }
    const year = 2000
    expect(ageOf(year, now.getMonth() + 1, now.getDate())).toBe(now.getFullYear() - year)
    expect(ageOf(year, nextMonth.m, 1)).toBe(now.getFullYear() - year - 1)
    expect(ageOf(null)).toBeNull()
  })

  it('按生日临近排序：无生日者排最后', () => {
    const near = store.addRelation({ name: '近', ...birthdayInDays(3) })
    const far = store.addRelation({ name: '远', ...birthdayInDays(200) })
    const none = store.addRelation({ name: '无生日' })
    const list = [...store.state.relations].sort((a, b) => compareByBirthday(a, b))
    expect(list.map((x) => x.id)).toEqual([near.id, far.id, none.id])
  })
})

describe('关系 store actions', () => {
  it('新增/编辑/删除人物，好感度限定 1~5', () => {
    const r = store.addRelation({ name: '妈妈', gender: 'female', affinity: 9, ...birthdayInDays(10) })
    expect(r.affinity).toBe(5)
    store.updateRelation(r.id, { affinity: 0, place: '老家' })
    expect(store.state.relations[0].affinity).toBe(1)
    expect(store.state.relations[0].place).toBe('老家')
    store.deleteRelation(r.id)
    expect(store.state.relations).toHaveLength(0)
  })
})

function mountRel() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/relations', component: { template: '<div/>' } },
      { path: '/projects/:id', component: { template: '<div/>' } },
      { path: '/todos', component: { template: '<div/>' } },
      { path: '/blueprints', component: { template: '<div/>' } },
    ],
  })
  router.push('/relations')
  return mount(RelationsView, { global: { plugins: [router] } })
}

describe('关系页面', () => {
  it('列表展示人物信息与生日倒计时，默认按生日临近排序', async () => {
    store.addRelation({ name: '远的人', ...birthdayInDays(120) })
    store.addRelation({ name: '近的人', ...birthdayInDays(2), gender: 'female', place: '公司', affinity: 5 })
    const w = mountRel()
    await nextTick()
    expect(w.text()).toContain('近的人')
    const names = w.findAll('.r-name').map((n) => n.text())
    expect(names[0]).toBe('近的人')
    expect(w.text()).toContain('还有 2 天')
    expect(w.text()).toContain('公司')
    // 迷你月历：当月当前日期为今天标记
    expect(w.findAll('.mcell.today')).toHaveLength(1)
    w.unmount()
  })

  it('点击月历打开完整日历弹窗，选中日期显示生日人物与剩余天数', async () => {
    const bd = birthdayInDays(2)
    store.addRelation({ name: '小美', ...bd })
    const w = mountRel()
    await nextTick()
    await w.find('.mini-card').trigger('click')
    await nextTick()
    const modal = document.body.textContent
    expect(modal).toContain('生日日历')
    expect(modal).toContain('小美')
    // 弹窗默认选中今天；点选生日当天
    const day = new Date()
    day.setDate(day.getDate() + 2)
    const targetDayTs = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
    const cells = [...document.querySelectorAll('.bcal .cell')]
    const target = cells.find((c) => c.textContent.trim().startsWith(String(day.getDate())))
    target.click()
    await nextTick()
    expect(document.body.textContent).toContain('距生日 2 天')
    expect(targetDayTs).toBeGreaterThan(0)
    w.unmount()
  })

  it('切换排序为好感度时高好感居首', async () => {
    store.addRelation({ name: '普通朋友', ...birthdayInDays(1), affinity: 2 })
    store.addRelation({ name: '挚友', ...birthdayInDays(50), affinity: 5 })
    const w = mountRel()
    await nextTick()
    const segs = w.findAll('.seg-item')
    await segs[1].trigger('click') // 好感度
    await nextTick()
    expect(w.findAll('.r-name')[0].text()).toBe('挚友')
    w.unmount()
  })
})

describe('首页近期生日板块', () => {
  it('显示 30 天内生日的人，超过 30 天不显示', async () => {
    store.addRelation({ name: '快过生日', ...birthdayInDays(5) })
    store.addRelation({ name: '还早的人', ...birthdayInDays(120) })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div/>' } },
        { path: '/relations', component: { template: '<div/>' } },
        { path: '/todos', component: { template: '<div/>' } },
        { path: '/blueprints', component: { template: '<div/>' } },
        { path: '/projects/:id', component: { template: '<div/>' } },
      ],
    })
    router.push('/')
    const w = mount(HomeView, { global: { plugins: [router] } })
    await nextTick()
    expect(w.text()).toContain('近期生日')
    expect(w.text()).toContain('快过生日')
    expect(w.text()).toContain('还有 5 天')
    expect(w.text()).not.toContain('还早的人')
    w.unmount()
  })
})
