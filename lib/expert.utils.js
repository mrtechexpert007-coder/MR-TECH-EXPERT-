// ⟦EXPERT⟧ small helpers
export const expertSleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const expertPick = (arr) => arr[Math.floor(Math.random() * arr.length)]

export const expertRand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

export function expertUptime(totalSeconds) {
  let s = Math.floor(totalSeconds)
  const d = Math.floor(s / 86400); s %= 86400
  const h = Math.floor(s / 3600); s %= 3600
  const m = Math.floor(s / 60); s %= 60
  const parts = []
  if (d) parts.push(`${d}d`)
  if (d || h) parts.push(`${h}h`)
  if (d || h || m) parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join(' ')
}

export function expertBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${units[i]}`
}

export const expertNumber = (jid = '') => String(jid).split('@')[0].split(':')[0].replace(/\D/g, '')

export const expertLog = {
  info: (...a) => console.log('\x1b[36m[EXPERT]\x1b[0m', ...a),
  ok: (...a) => console.log('\x1b[32m[EXPERT]\x1b[0m', ...a),
  warn: (...a) => console.log('\x1b[33m[EXPERT]\x1b[0m', ...a),
  err: (...a) => console.log('\x1b[31m[EXPERT]\x1b[0m', ...a)
}
