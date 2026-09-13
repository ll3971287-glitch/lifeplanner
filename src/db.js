const DB_NAME = 'lifeplanner' // 库名保留：改名会使浏览器里已存的本地数据“消失”（换库不迁移）
const STORE = 'kv'
const DATA_KEY = 'data'
const BACKUP_KEY = 'backup'

let _db = null
let _openPromise = null

function open() {
  if (!_openPromise) {
    _openPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE)
      }
      req.onsuccess = () => {
        _db = req.result
        resolve(_db)
      }
      req.onerror = () => reject(req.error)
    })
  }
  return _openPromise
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function get(key) {
  const d = await open()
  return reqToPromise(d.transaction(STORE, 'readonly').objectStore(STORE).get(key))
}

async function set(key, value) {
  const d = await open()
  return reqToPromise(d.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key))
}

async function del(key) {
  const d = await open()
  return reqToPromise(d.transaction(STORE, 'readwrite').objectStore(STORE).delete(key))
}

function clone(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v))
}

export const db = {
  async load() {
    const v = await get(DATA_KEY)
    return v == null ? null : v
  },

  async save(data) {
    await set(DATA_KEY, clone(data))
  },

  async backupCurrent() {
    const v = await get(DATA_KEY)
    if (v != null) await set(BACKUP_KEY, v)
  },

  async restoreBackup() {
    const v = await get(BACKUP_KEY)
    if (v == null) return null
    await set(DATA_KEY, v)
    return v
  },

  async clearData() {
    await this.backupCurrent()
    await del(DATA_KEY)
  },

  async wipe() {
    if (_db) {
      _db.close()
      _db = null
    }
    _openPromise = null
    await new Promise((resolve) => {
      const r = indexedDB.deleteDatabase(DB_NAME)
      r.onsuccess = () => resolve()
      r.onerror = () => resolve()
      r.onblocked = () => resolve()
    })
  },
}
