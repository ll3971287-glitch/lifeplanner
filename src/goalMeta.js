// 目标板块：周期（月度/季度）与卡片工具

export const GOAL_SCOPES = [
  { key: 'month', label: '月度', count: 12 },
  { key: 'quarter', label: '季度', count: 4 },
]

export function noteKey(year, scope, index) {
  return `${scope}-${year}-${index}`
}

export function periodTitle(year, scope, index) {
  if (scope === 'quarter') return `${year} 年 第 ${index + 1} 季度`
  return `${year} 年 ${index + 1} 月`
}

export function periodShort(year, scope, index) {
  if (scope === 'quarter') return `Q${index + 1}`
  return `${index + 1} 月`
}

// 该周期覆盖的月份下标（0-11）
export function periodMonths(scope, index) {
  if (scope === 'quarter') return [index * 3, index * 3 + 1, index * 3 + 2]
  return [index]
}

export function periodRange(year, scope, index) {
  const months = periodMonths(scope, index)
  const startMonth = months[0]
  const endMonth = months[months.length - 1] + 1
  return {
    startTs: new Date(year, startMonth, 1).getTime(),
    endTs: new Date(year, endMonth, 1).getTime(),
  }
}

// 复盘周期 → 目标周期：日/周/月复盘看当月，年/五年复盘看全年
export function goalScopeForReview(reviewType) {
  if (reviewType === 'year' || reviewType === 'five') return 'year'
  return 'month'
}
