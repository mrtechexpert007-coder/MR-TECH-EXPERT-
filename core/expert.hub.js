// ⟦EXPERT⟧ the hub — one shared registry for every linked session
import path from 'node:path'
import { fileURLToPath } from 'node:url'
export const EXPERT_SIG = 'ⓅⓇⒾⓃⒸⒺ::𝙿𝚁𝙸𝙽𝙲𝙴 𝙼𝙸𝙽𝙸'

export const expertHub = (globalThis.__expertHub ??= {
  sig: EXPERT_SIG,
  startedAt: Date.now(),
  sessions: new Map(), // number -> session { number, sock, opened, startedAt, ... }
  pair: new Map(),     // number -> { status, code, at }
  commands: new Map()  // name -> command
})

// ── error locator: "commands/play.js:81" from an Error stack (first frame inside this project) ──
const EXPERT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export function expertWhere(stack = '') {
  for (const line of String(stack).split('\n')) {
    const m = line.match(/(file:\/\/\S+?\.m?js):(\d+)/)
    if (!m) continue
    let p
    try { p = fileURLToPath(m[1]) } catch { continue }
    if (p.includes('/node_modules/')) continue
    return `${path.relative(EXPERT_ROOT, p) || p}:${m[2]}`
  }
  return ''
}

// ── remembers the last runtime error of each command (shown by .scan) ──
export function expertRecordCmdError(cmd, e) {
  const map = (expertHub.cmdErrors ??= new Map())
  const prev = map.get(cmd.name)
  map.set(cmd.name, {
    count: (prev?.count || 0) + 1,
    message: String(e instanceof Error ? e.message : e).slice(0, 160),
    where: expertWhere(e instanceof Error ? e.stack : ''),
    at: Date.now()
  })
}
