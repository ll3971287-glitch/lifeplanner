import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/db.js'

const seed = { version: 1, todos: [{ id: 'a', title: '任务A' }], tags: [] }

describe('IndexedDB 封装', () => {
  beforeEach(async () => {
    await db.wipe()
  })

  it('空库 load 返回 null', async () => {
    expect(await db.load()).toBeNull()
  })

  it('save / load 往返且内容一致', async () => {
    await db.save(seed)
    const loaded = await db.load()
    expect(loaded).toEqual(seed)
  })

  it('save 深拷贝，之后改动原对象不影响已存数据', async () => {
    const data = { todos: [{ id: 'x' }] }
    await db.save(data)
    data.todos[0].id = 'changed'
    const loaded = await db.load()
    expect(loaded.todos[0].id).toBe('x')
  })

  it('backupCurrent + restoreBackup 恢复旧数据', async () => {
    await db.save(seed)
    await db.backupCurrent()
    const next = { version: 1, todos: [{ id: 'b' }] }
    await db.save(next)
    expect((await db.load()).todos[0].id).toBe('b')
    const restored = await db.restoreBackup()
    expect(restored.todos[0].id).toBe('a')
    expect((await db.load()).todos[0].id).toBe('a')
  })

  it('无数据时 backupCurrent 不产生备份，restoreBackup 返回 null', async () => {
    await db.backupCurrent()
    expect(await db.restoreBackup()).toBeNull()
  })

  it('clearData 先备份再清空主数据', async () => {
    await db.save(seed)
    await db.clearData()
    expect(await db.load()).toBeNull()
    const restored = await db.restoreBackup()
    expect(restored.todos[0].id).toBe('a')
  })

  it('wipe 后 load 为 null', async () => {
    await db.save(seed)
    await db.wipe()
    expect(await db.load()).toBeNull()
  })
})
