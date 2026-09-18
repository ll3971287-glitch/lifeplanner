import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { store, defaultState } from '../src/store.js'
import { mediaOf, mediaCounts, mediaCategoryStats, mediaFavorites } from '../src/selectors.js'
import { progressInfo, ratingStars, wishLabel } from '../src/mediaMeta.js'
import MediaView from '../src/views/MediaView.vue'
import MediaCard from '../src/components/media/MediaCard.vue'
import MediaDrawer from '../src/components/media/MediaDrawer.vue'
import MediaFormModal from '../src/components/media/MediaFormModal.vue'
import MediaTimeline from '../src/components/media/MediaTimeline.vue'
import ReviewFormModal from '../src/components/review/ReviewFormModal.vue'
import { mediaOverview, mediaTopRated, mediaTimeline, recentMedia } from '../src/selectors.js'
import HomeView from '../src/views/HomeView.vue'
import { DAY_MS } from '../src/utils/date.js'

beforeEach(() => {
  store._replace(defaultState())
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('书影音：进度与评分工具', () => {
  it('各品类进度计算', () => {
    expect(progressInfo({ category: 'book', totalPages: 300, currentPage: 120 }).pct).toBe(40)
    expect(progressInfo({ category: 'book', totalPages: 300, currentPage: 120 }).text).toBe('120/300 页')
    expect(progressInfo({ category: 'series', totalEpisodes: 24, watchedEpisodes: 6 }).pct).toBe(25)
    expect(progressInfo({ category: 'anime', totalEpisodes: 12, watchedEpisodes: 3 }).text).toBe('3/12 集')
    // 电影无进度条（单作品记录）
    expect(progressInfo({ category: 'movie', status: 'doing' }).pct).toBeNull()
    // 游戏汇总时长/关卡/成就
    const g = progressInfo({ category: 'game', playHours: 12.5, levels: '序章、第二关', achievements: ['通关', '全收集'] })
    expect(g.text).toContain('12.5 小时')
    expect(g.text).toContain('2 个关卡')
    expect(g.text).toContain('2 个成就')
    // 已完成 → 100%
    expect(progressInfo({ category: 'movie', status: 'done' }).pct).toBe(100)
  })

  it('评分星与收藏清单名称', () => {
    expect(ratingStars(3)).toBe('★★★☆☆')
    expect(ratingStars(0)).toBe('☆☆☆☆☆')
    expect(wishLabel('book')).toBe('想读')
    expect(wishLabel('movie')).toBe('想看')
    expect(wishLabel('game')).toBe('想玩')
  })
})

describe('书影音：store actions', () => {
  it('新增/编辑/状态切换/收藏/删除', () => {
    const m = store.addMedia({ category: 'book', title: '活着', creator: '余华', totalPages: 200, favorite: true })
    expect(m.status).toBe('todo')
    expect(m.rating).toBe(0)
    expect(mediaOf(store.state, 'book')).toHaveLength(1)
    store.updateMedia(m.id, { rating: 9, currentPage: 150 })
    expect(store.state.mediaItems[0].rating).toBe(5) // 评分上限 5
    expect(store.state.mediaItems[0].currentPage).toBe(150)
    // 开始 → 自动记录开始时间
    store.setMediaStatus(m.id, 'doing')
    expect(store.state.mediaItems[0].startDate).not.toBeNull()
    // 完成 → 自动记录完结时间
    store.setMediaStatus(m.id, 'done')
    expect(store.state.mediaItems[0].endDate).not.toBeNull()
    // 收藏切换
    expect(mediaFavorites(store.state, 'book')).toHaveLength(0) // 已完成不在收藏清单
    store.toggleFavorite(m.id)
    expect(store.state.mediaItems[0].favorite).toBe(false)
    store.deleteMedia(m.id)
    expect(store.state.mediaItems).toHaveLength(0)
  })

  it('统计：各品类数量、完成率', () => {
    store.addMedia({ category: 'book', title: 'A', status: 'done' })
    store.addMedia({ category: 'book', title: 'B', status: 'doing' })
    store.addMedia({ category: 'movie', title: 'C' })
    expect(mediaCounts(store.state)).toEqual({ book: 2, movie: 1 })
    expect(mediaCategoryStats(store.state, 'book')).toMatchObject({ total: 2, done: 1, doing: 1, rate: 50 })
    expect(mediaCategoryStats(store.state, 'movie').rate).toBe(0)
  })
})

describe('书影音页面', () => {
  it('按品类切换只展示当前品类', async () => {
    store.addMedia({ category: 'book', title: '一本好书' })
    store.addMedia({ category: 'movie', title: '一部电影' })
    store.addMedia({ category: 'game', title: '一个游戏' })
    const w = mount(MediaView)
    await nextTick()
    expect(w.text()).toContain('一本好书')
    expect(w.text()).not.toContain('一部电影')
    expect(w.text()).not.toContain('一个游戏')
    // seg 顺序：视图(卡片/时间线) 2 项 → 品类 5 项 → 状态 6 项
    const cats = w.findAll('.seg-item')
    await cats[3].trigger('click') // 电影（品类第 2 项）
    await nextTick()
    expect(w.text()).toContain('一部电影')
    expect(w.text()).not.toContain('一本好书')
    await cats[6].trigger('click') // 游戏（品类第 5 项）
    await nextTick()
    expect(w.text()).toContain('一个游戏')
    w.unmount()
  })

  it('状态筛选与完成率统计', async () => {
    store.addMedia({ category: 'book', title: '完读', status: 'done' })
    store.addMedia({ category: 'book', title: '在读', status: 'doing' })
    const w = mount(MediaView)
    await nextTick()
    expect(w.text()).toContain('完成率 50%')
    const segs = w.findAll('.seg-item')
    await segs[10].trigger('click') // 视图2 + 品类5 之后是 全部/未开始/进行中/已完成/已搁置；索引 10 = 已完成
    await nextTick()
    expect(w.text()).toContain('完读')
    expect(w.text()).not.toContain('在读')
    w.unmount()
  })

  it('收藏清单展示且可一键开始', async () => {
    const m = store.addMedia({ category: 'book', title: '想读的书', favorite: true })
    const w = mount(MediaView)
    await nextTick()
    expect(w.text()).toContain('想读清单')
    expect(w.text()).toContain('想读的书')
    const startBtn = w.findAll('button').find((b) => b.text().includes('一键开始'))
    await startBtn.trigger('click')
    await nextTick()
    expect(store.state.mediaItems[0].status).toBe('doing')
    // 转为进行中后不再出现在想读清单
    expect(w.text()).not.toContain('想读清单')
    expect(mediaFavorites(store.state, 'book')).toHaveLength(0)
    w.unmount()
  })
})

describe('书影音：表单与详情', () => {
  it('表单按品类显示专属字段并可保存', async () => {
    const w = mount(MediaFormModal, { props: { open: true, defaultCategory: 'book' } })
    await nextTick()
    expect(document.body.textContent).toContain('总页数')
    expect(document.body.textContent).toContain('已读页数')
    const inputs = [...document.querySelectorAll('.modal-panel input')]
    const titleInput = inputs.find((i) => i.placeholder === '书名')
    titleInput.value = '活着'
    titleInput.dispatchEvent(new Event('input'))
    await nextTick()
    const save = [...document.querySelectorAll('.modal-panel button')].find((b) => b.textContent.includes('保存'))
    save.click()
    await nextTick()
    expect(store.state.mediaItems).toHaveLength(1)
    expect(store.state.mediaItems[0].title).toBe('活着')
    expect(store.state.mediaItems[0].category).toBe('book')
    w.unmount()
  })

  it('游戏品类显示时长与关卡字段', async () => {
    const w = mount(MediaFormModal, { props: { open: true, defaultCategory: 'game' } })
    await nextTick()
    const text = document.body.textContent
    expect(text).toContain('游玩时长（小时）')
    expect(text).toContain('关卡记录')
    expect(text).not.toContain('总页数')
    w.unmount()
  })

  it('详情抽屉：状态切换、进度推进、集数随笔与成就', async () => {
    const s = store.addMedia({ category: 'series', title: '某剧', totalEpisodes: 10, watchedEpisodes: 0 })
    const w = mount(MediaDrawer, { props: { open: true, itemId: s.id } })
    await nextTick()
    const panel = () => document.querySelector('.drawer-panel')
    // 切换为进行中
    const doing = [...panel().querySelectorAll('.st-btn')].find((b) => b.textContent.includes('进行中'))
    doing.click()
    await nextTick()
    expect(store.state.mediaItems[0].status).toBe('doing')
    // +1 集
    const bump = [...panel().querySelectorAll('button')].find((b) => b.textContent.includes('+1 集'))
    bump.click()
    await nextTick()
    expect(store.state.mediaItems[0].watchedEpisodes).toBe(1)
    // 添加单集随笔
    const epInput = panel().querySelector('.ep-input')
    epInput.value = '2'
    epInput.dispatchEvent(new Event('input'))
    const noteInput = panel().querySelector('.add-note .note-input')
    noteInput.value = '第二集太精彩'
    noteInput.dispatchEvent(new Event('input'))
    await nextTick()
    const addBtn = [...panel().querySelectorAll('.add-note button')].find((b) => b.textContent.includes('添加'))
    addBtn.click()
    await nextTick()
    expect(store.state.mediaItems[0].episodeNotes).toEqual([{ ep: 2, note: '第二集太精彩' }])
    // 删除随笔
    panel().querySelector('.note-row .mini.del').click()
    await nextTick()
    expect(store.state.mediaItems[0].episodeNotes).toHaveLength(0)
    w.unmount()

    // 游戏成就
    const g = store.addMedia({ category: 'game', title: '某游戏' })
    const w2 = mount(MediaDrawer, { props: { open: true, itemId: g.id } })
    await nextTick()
    const p2 = () => document.querySelector('.drawer-panel')
    const achInput = p2().querySelector('.ach-input')
    achInput.value = '初见通关'
    achInput.dispatchEvent(new Event('input'))
    await nextTick()
    const add = [...p2().querySelectorAll('button')].find((b) => b.textContent.includes('添加'))
    add.click()
    await nextTick()
    expect(store.state.mediaItems.find((m) => m.id === g.id).achievements).toEqual(['初见通关'])
    w2.unmount()
  })
})

describe('书影音：第二阶段（总览 / TOP / 时间线 / 复盘联动）', () => {
  it('数据总览：各品类数量与完成率', () => {
    store.addMedia({ category: 'book', title: 'A', status: 'done' })
    store.addMedia({ category: 'book', title: 'B' })
    store.addMedia({ category: 'game', title: 'C', status: 'done' })
    const ov = mediaOverview(store.state)
    expect(ov.total).toBe(3)
    expect(ov.done).toBe(2)
    expect(ov.rate).toBe(67)
    const book = ov.byCat.find((c) => c.key === 'book')
    expect(book).toMatchObject({ total: 2, done: 1, rate: 50 })
  })

  it('年度 TOP：按评分排序，当年无则回退全部时间', () => {
    const y = new Date().getFullYear()
    store.addMedia({ category: 'book', title: '高分书', status: 'done', rating: 5, endDate: new Date(y, 5, 1).getTime() })
    store.addMedia({ category: 'movie', title: '普通片', status: 'done', rating: 3, endDate: new Date(y, 5, 2).getTime() })
    store.addMedia({ category: 'game', title: '去年的神作', status: 'done', rating: 5, endDate: new Date(y - 1, 3, 1).getTime() })
    const top = mediaTopRated(store.state, y)
    expect(top.map((m) => m.title)).toEqual(['高分书', '普通片'])
    // 全部时间含去年的
    expect(mediaTopRated(store.state, null)).toHaveLength(3)
  })

  it('时间线按时间倒序并分组', () => {
    const now = Date.now()
    store.addMedia({ category: 'book', title: '上个月', status: 'done', endDate: now - 40 * DAY_MS })
    store.addMedia({ category: 'movie', title: '今天', status: 'done', endDate: now })
    const list = mediaTimeline(store.state)
    expect(list[0].title).toBe('今天')
    expect(list[1].title).toBe('上个月')
  })

  it('页面：总览卡与时间线视图切换', async () => {
    const now = Date.now()
    store.addMedia({ category: 'book', title: '带评分的书', status: 'done', rating: 4, endDate: now })
    const w = mount(MediaView)
    await nextTick()
    expect(w.text()).toContain('书影音总览')
    expect(w.text()).toContain('完成率')
    expect(w.text()).toContain('TOP')
    // 切换到时间线视图
    const segs = w.findAll('.seg-item')
    await segs[1].trigger('click')
    await nextTick()
    expect(w.text()).toContain('按时间倒序展示全部品类')
    expect(w.text()).toContain('带评分的书')
    expect(w.findComponent(MediaTimeline).exists()).toBe(true)
    w.unmount()
  })

  it('复盘表单可插入本周期书影音记录（且不修改原始数据）', async () => {
    const now = Date.now()
    const m = store.addMedia({ category: 'book', title: '本周读完的书', creator: '某作者', status: 'done', rating: 5, endDate: now, oneLine: '非常推荐' })
    const w = mount(ReviewFormModal, { props: { defaultType: 'week' } })
    await nextTick()
    const btn = w.findAll('button').find((b) => b.text().includes('插入书影音记录'))
    await btn.trigger('click')
    await nextTick()
    const events = w.vm.form.fields.events
    expect(events).toContain('读完《本周读完的书》')
    expect(events).toContain('某作者')
    expect(events).toContain('非常推荐')
    // 原始记录未被修改
    const after = store.state.mediaItems.find((x) => x.id === m.id)
    expect(after.title).toBe('本周读完的书')
    expect(after.oneLine).toBe('非常推荐')
    w.unmount()
  })
})

describe('首页「最近在看」板块', () => {
  async function mountHome() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div/>' } },
        { path: '/media', component: { template: '<div/>' } },
        { path: '/todos', component: { template: '<div/>' } },
        { path: '/blueprints', component: { template: '<div/>' } },
        { path: '/relations', component: { template: '<div/>' } },
        { path: '/projects/:id', component: { template: '<div/>' } },
      ],
    })
    router.push('/')
    const w = mount(HomeView, { global: { plugins: [router] } })
    return { w, router }
  }

  it('展示进行中的书影音记录，点击打开详情抽屉', async () => {
    const m = store.addMedia({ category: 'book', title: '正在读的书', creator: '某作者', status: 'doing', totalPages: 300, currentPage: 90 })
    const { w } = await mountHome()
    await nextTick()
    expect(w.text()).toContain('最近在看')
    expect(w.text()).toContain('正在读的书')
    expect(w.text()).toContain('90/300 页')
    const row = w.findAll('.h-row').find((r) => r.text().includes('正在读的书'))
    await row.trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain('进度')
    expect(document.body.textContent).toContain('私密备忘录')
    w.unmount()
    expect(m.status).toBe('doing')
  })

  it('没有进行中记录时不显示该板块（回退最近更新由选择器保证）', async () => {
    expect(recentMedia(store.state)).toHaveLength(0)
    const { w } = await mountHome()
    await nextTick()
    expect(w.text()).not.toContain('最近在看')
    w.unmount()
  })
})
