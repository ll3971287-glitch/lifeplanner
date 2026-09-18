import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { store, defaultState } from '../src/store.js'
import { mediaOf, mediaCounts, mediaCategoryStats, mediaFavorites } from '../src/selectors.js'
import { progressInfo, ratingStars, wishLabel } from '../src/mediaMeta.js'
import MediaView from '../src/views/MediaView.vue'
import MediaCard from '../src/components/media/MediaCard.vue'
import MediaDrawer from '../src/components/media/MediaDrawer.vue'
import MediaFormModal from '../src/components/media/MediaFormModal.vue'

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
    const cats = w.findAll('.seg-item')
    await cats[1].trigger('click') // 电影
    await nextTick()
    expect(w.text()).toContain('一部电影')
    expect(w.text()).not.toContain('一本好书')
    await cats[4].trigger('click') // 游戏
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
    await segs[8].trigger('click') // 前 5 项是品类，之后是 全部/未开始/进行中/已完成/已搁置；索引 8 = 已完成
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
