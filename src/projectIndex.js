// 项目名称的拼音首字母索引：排序 + 分组 + 可点击定位的字母表

import { hanInitial } from './pinyinInitialData.js'

export const INDEX_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#']

// 名称首字母：英文取首字母大写；汉字查内置首字母表；其它（数字/符号）归入 #
export function initialOf(name) {
  const s = String(name == null ? '' : name).trim()
  if (!s) return '#'
  const ch = s[0]
  if (/[A-Za-z]/.test(ch)) return ch.toUpperCase()
  return hanInitial(ch) || '#'
}

// 运行环境支持拼音排序时用它（Chrome 支持），否则退化为「首字母序列」排序
let pinyinCollator = null
let collatorChecked = false

function getPinyinCollator() {
  if (!collatorChecked) {
    collatorChecked = true
    try {
      const c = new Intl.Collator('zh-Hans-CN-u-co-pinyin', { sensitivity: 'base' })
      if (c.resolvedOptions().collation === 'pinyin') pinyinCollator = c
    } catch (e) {
      pinyinCollator = null
    }
  }
  return pinyinCollator
}

function initialSeqOf(name) {
  let out = ''
  for (const ch of String(name == null ? '' : name)) out += initialOf(ch)
  return out
}

function compareNames(a, b) {
  const na = String(a == null ? '' : a)
  const nb = String(b == null ? '' : b)
  const c = getPinyinCollator()
  if (c) return c.compare(na, nb)
  const sa = initialSeqOf(na)
  const sb = initialSeqOf(nb)
  if (sa !== sb) return sa < sb ? -1 : 1
  return na.localeCompare(nb)
}

export function sortByName(list) {
  return [...list].sort((a, b) => compareNames(a.name, b.name))
}

// 按首字母分组，返回 [{ letter, items }]，字母顺序固定
export function groupByInitial(list) {
  const bucket = new Map()
  for (const item of sortByName(list)) {
    const letter = initialOf(item.name)
    if (!bucket.has(letter)) bucket.set(letter, [])
    bucket.get(letter).push(item)
  }
  return INDEX_LETTERS.filter((l) => bucket.has(l)).map((l) => ({ letter: l, items: bucket.get(l) }))
}
