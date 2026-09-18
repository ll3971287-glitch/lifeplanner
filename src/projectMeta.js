// 项目分类：学习 / 项目 / 规划（可自由调整，不受项目「类型」字段限制）

export const PROJECT_CATS = [
  { key: 'study', label: '学习分类', short: '学习', color: '#5476B8' },
  { key: 'project', label: '项目分类', short: '项目', color: '#0EA5E9' },
  { key: 'plan', label: '规划分类', short: '规划', color: '#9C6ADE' },
]

export const DEFAULT_PROJECT_CAT = 'project'

export function catOf(p) {
  const k = p && p.category
  if (PROJECT_CATS.some((c) => c.key === k)) return k
  // 老数据（没有分类字段）按原「类型」兜底：学习 → 学习分类，其余 → 项目分类
  if (p && p.type === '学习') return 'study'
  return DEFAULT_PROJECT_CAT
}

export function catMeta(p) {
  const key = catOf(p)
  return PROJECT_CATS.find((c) => c.key === key) || PROJECT_CATS[1]
}

export function catLabel(p) {
  return catMeta(p).short
}

export function catLabelOfKey(key) {
  const c = PROJECT_CATS.find((x) => x.key === key)
  return c ? c.label : ''
}

export function catColor(p) {
  return catMeta(p).color
}
