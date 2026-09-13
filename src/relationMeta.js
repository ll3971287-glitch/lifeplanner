// 关系模块：性别 / 好感度 / 生日计算

export const GENDERS = [
  { key: 'female', label: '女', color: '#E05C8C' },
  { key: 'male', label: '男', color: '#3B82F6' },
  { key: 'other', label: '其他', color: '#9CA3AF' },
]

export const AFFINITY_MAX = 5

export function genderOf(key) {
  return GENDERS.find((g) => g.key === key) || GENDERS[2]
}
export function genderLabel(key) {
  return genderOf(key).label
}
export function genderColor(key) {
  return genderOf(key).color
}

export function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

// 闰日 2/29 在平年按 2/28 计
function birthdayDate(year, month, day) {
  const d = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day
  return new Date(year, month - 1, d)
}

// 距下次生日天数：当天为 0，今年已过则算明年；无生日返回 null
export function daysUntilBirthday(month, day, nowTs = Date.now()) {
  if (!month || !day) return null
  const now = new Date(nowTs)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let target = birthdayDate(now.getFullYear(), month, day)
  if (target < today) target = birthdayDate(now.getFullYear() + 1, month, day)
  return Math.round((target - today) / 86400000)
}

export function nextBirthdayTs(month, day, nowTs = Date.now()) {
  const days = daysUntilBirthday(month, day, nowTs)
  if (days == null) return null
  const now = new Date(nowTs)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return today.getTime() + days * 86400000
}

// 年龄：给了出生年月日则按生日是否已过精确计算；仅有年份按年差
export function ageOf(birthYear, month, day, nowTs = Date.now()) {
  if (!birthYear) return null
  const now = new Date(nowTs)
  let age = now.getFullYear() - birthYear
  if (month && day) {
    const bd = birthdayDate(now.getFullYear(), month, day)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (bd > today) age -= 1
  }
  return age
}

export function birthdayText(r) {
  if (!r.birthMonth || !r.birthDay) return ''
  const md = `${String(r.birthMonth).padStart(2, '0')}-${String(r.birthDay).padStart(2, '0')}`
  return r.birthYear ? `${r.birthYear}-${md}` : md
}

// 关系排序：按生日临近（无生日的排最后，同距离按名称）
export function compareByBirthday(a, b, nowTs = Date.now()) {
  const da = daysUntilBirthday(a.birthMonth, a.birthDay, nowTs)
  const db = daysUntilBirthday(b.birthMonth, b.birthDay, nowTs)
  if (da == null && db == null) return (a.name || '').localeCompare(b.name || '')
  if (da == null) return 1
  if (db == null) return -1
  if (da !== db) return da - db
  return (a.name || '').localeCompare(b.name || '')
}
