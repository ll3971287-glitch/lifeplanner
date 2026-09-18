// 专注提示音：Web Audio 程序合成（无需音频文件，离线可用）
// 需在用户手势中调用 unlockAudio() 以解锁移动端音频

let ctx = null

export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    if (!ctx) ctx = new AC()
    if (ctx.state === 'suspended') ctx.resume()
  } catch (e) {
    /* 忽略：部分环境不支持音频 */
  }
}

function tone(freq, delay, dur, gain = 0.16, type = 'sine') {
  if (!ctx) return
  const t0 = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  // 简单的 attack / decay 包络，避免爆音
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

// 音效定义：专注结束（上行三声）/ 休息结束（柔和两声）/ 链式解锁（短促两声）/ 链式超时（警示低音）
export const CHIMES = {
  focusEnd: [
    [880, 0, 0.18],
    [1108.7, 0.18, 0.18],
    [1318.5, 0.36, 0.34],
  ],
  breakEnd: [
    [659.3, 0, 0.2],
    [880, 0.22, 0.32],
  ],
  chainUnlock: [
    [740, 0, 0.12],
    [988, 0.14, 0.2],
  ],
  chainTimeout: [
    [466.2, 0, 0.18],
    [349.2, 0.2, 0.3],
  ],
}

export function playChime(kind = 'focusEnd') {
  const notes = CHIMES[kind] || CHIMES.focusEnd
  unlockAudio()
  if (!ctx) return
  for (const [freq, delay, dur] of notes) tone(freq, delay, dur)
}

export function soundSupported() {
  return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext)
}
