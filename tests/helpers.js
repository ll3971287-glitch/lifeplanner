import { createStore } from '../src/store.js'

export function memDb() {
  let data = null
  let backup = null
  return {
    async load() {
      return data ? JSON.parse(JSON.stringify(data)) : null
    },
    async save(d) {
      data = JSON.parse(JSON.stringify(d))
    },
    async backupCurrent() {
      if (data) backup = JSON.parse(JSON.stringify(data))
    },
    async restoreBackup() {
      data = backup ? JSON.parse(JSON.stringify(backup)) : null
      return data
    },
    async clearData() {
      await this.backupCurrent()
      data = null
    },
    async wipe() {
      data = null
      backup = null
    },
  }
}

export function makeStore(initTs = 1000000000000) {
  const clock = { v: initTs }
  const dbImpl = memDb()
  const store = createStore({ dbImpl, now: () => clock.v })
  return { store, dbImpl, clock }
}

export const MIN = 60000
export const HOUR = 3600000
export const DAY = 86400000
