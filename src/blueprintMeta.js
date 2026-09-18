// 未来蓝图模块：人生维度 / 状态 / 时间轴分段 / 颜色

export const BUILTIN_DIMS = [
  { id: 'study', label: '学习成长', color: '#5476B8' },
  { id: 'career', label: '职业发展', color: '#D97706' },
  { id: 'life', label: '生活体验', color: '#9C6ADE' },
  { id: 'health', label: '健康', color: '#2E9E8F' },
  { id: 'hobby', label: '爱好创作', color: '#E05C8C' },
  { id: 'finance', label: '财务', color: '#C29B26' },
  { id: 'social', label: '人际关系', color: '#3B82F6' },
]

export const CUSTOM_DIM_COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#14B8A6', '#84CC16', '#F97316']

// 蓝图状态机：构想中 → 进行中 ↔（可搁置，数据保留可恢复）→ 已完成
export const BLUEPRINT_STATUS = {
  idea: { label: '构想中', cls: 'idea' },
  doing: { label: '进行中', cls: 'doing' },
  paused: { label: '已搁置', cls: 'paused' },
  done: { label: '已完成', cls: 'done' },
}
export const STATUS_ORDER = ['idea', 'doing', 'paused', 'done']

// 蓝图等级：进度条区域按尺寸渲染，越大的蓝图优先级越高
export const BLUEPRINT_LEVELS = {
  small: { label: '小蓝图', weight: 1, barH: 24 },
  medium: { label: '中蓝图', weight: 2, barH: 34 },
  large: { label: '大蓝图', weight: 3, barH: 46 },
}
export const LEVEL_ORDER = ['small', 'medium', 'large']
export const DEFAULT_LEVEL = 'small'

export function levelOf(b) {
  const k = b && b.level
  return BLUEPRINT_LEVELS[k] ? k : DEFAULT_LEVEL
}
export function levelLabel(b) {
  return BLUEPRINT_LEVELS[levelOf(b)].label
}
export function levelWeight(b) {
  return BLUEPRINT_LEVELS[levelOf(b)].weight
}
export function levelBarH(b) {
  return BLUEPRINT_LEVELS[levelOf(b)].barH
}
export const BLUEPRINT_DEFAULT_STATUS = 'idea'

export const TIMELINE_SHORT_MS = 90 * 86400000 // 短期：≤3 个月
export const TIMELINE_MID_MS = 365 * 86400000 // 中期：≤1 年

export function dimColor(id, customDims) {
  const builtin = BUILTIN_DIMS.find((d) => d.id === id)
  if (builtin) return builtin.color
  const custom = (customDims || []).find((d) => d.id === id)
  if (custom && custom.color) return custom.color
  const idx = (customDims || []).findIndex((d) => d.id === id)
  if (idx >= 0) return CUSTOM_DIM_COLORS[idx % CUSTOM_DIM_COLORS.length]
  return '#9ca3af'
}

export function dimLabel(id, customDims) {
  const builtin = BUILTIN_DIMS.find((d) => d.id === id)
  if (builtin) return builtin.label
  const custom = (customDims || []).find((d) => d.id === id)
  return custom ? custom.name : ''
}

export function dimLabelOr(id, customDims, fallback) {
  return dimLabel(id, customDims) || fallback
}

// 期望达成时间段：goalStartTs(起点，可空) ~ goalEndTs(终点)；旧版 goalDateTs 单点视为终点
// 时间轴/日历/临期提醒均以终点为准
export function goalEnd(b) {
  if (!b) return null
  return b.goalEndTs != null ? b.goalEndTs : b.goalDateTs != null ? b.goalDateTs : null
}

export function goalStart(b) {
  if (!b) return null
  return b.goalStartTs != null ? b.goalStartTs : null
}

export function allDims(state) {
  return [...BUILTIN_DIMS, ...(state.settings.blueprintDims || [])]
}

// 时间轴分段：返回 short | mid | long | null（无日期不进时间轴）
export function timelineSegment(ts, nowTs = Date.now()) {
  if (ts == null) return null
  const diff = ts - nowTs
  if (diff <= TIMELINE_SHORT_MS) return 'short'
  if (diff <= TIMELINE_MID_MS) return 'mid'
  return 'long'
}

export const TIMELINE_SEGS = [
  { key: 'short', label: '短期（3 个月内）' },
  { key: 'mid', label: '中期（一年内）' },
  { key: 'long', label: '长期（一年以上）' },
]
