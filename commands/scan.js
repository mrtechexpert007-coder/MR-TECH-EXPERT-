// ⟦EXPERT⟧ .scan — finds commands that are broken and shows WHERE (file + line). Owner only.
//   .scan          full report
//   .scan clear    reset the runtime error log
//
// Checks:  1) syntax errors (exact line)     2) imports: missing file / missing export / missing package
//          3) commands the loader skipped or failed to load   4) two files using the same command name
//          5) errors that happened while a command was RUNNING (needs the patched loader + handler)
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expertHub } from '../core/expert.hub.js'

const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dir, '..')

const lineAt = (src, i) => src.slice(0, i).split('\n').length
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const short = (s, n = 120) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const cap = (arr, n = 25) => (arr.length > n ? [...arr.slice(0, n), `…and ${arr.length - n} more`] : arr)

function ago(ms) {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000))
  if (s < 90) return `${s}s ago`
  if (s < 5400) return `${Math.round(s / 60)}m ago`
  return s < 129600 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`
}

// run `fn` over `items`, at most `n` at a time (each node --check is a process, keep memory low)
async function pool(items, n, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++
        out[k] = await fn(items[k])
      }
    })
  )
  return out
}

// 1) syntax — `node --check` reports the exact line
function syntaxCheck(file) {
  return new Promise((resolve) => {
    execFile(process.execPath, ['--check', file], { cwd: root, timeout: 20000 }, (err, _out, stderr) => {
      if (!err || !stderr) return resolve(null)
      const text = String(stderr)
      const line = Number(text.split('\n')[0].match(/:(\d+)\s*$/)?.[1]) || null
      const msg = text.match(/^\w*Error: .*$/m)?.[0] || 'syntax error'
      resolve({ line, msg })
    })
  })
}

// 2) imports — what a file imports must exist, and must export what it asks for
const exportsCache = new Map()
function exportsOf(file) {
  if (exportsCache.has(file)) return exportsCache.get(file)
  let info = null
  try {
    const s = fs.readFileSync(file, 'utf8')
    const names = new Set()
    // `export *` or destructured exports: we can't list the names reliably → don't judge
    const unknown = /^\s*export\s*\*\s*from/m.test(s) || /^\s*export\s+(?:const|let|var)\s*[[{]/m.test(s)
    for (const m of s.matchAll(/^\s*export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([\w$]+)/gm)) names.add(m[1])
    for (const m of s.matchAll(/^\s*export\s*\{([^}]*)\}/gm)) {
      for (const part of m[1].split(',')) {
        const p = part.trim()
        if (p) names.add(p.split(/\s+as\s+/).pop().trim())
      }
    }
    if (/^\s*export\s+default\b/m.test(s)) names.add('default')
    info = { names, unknown }
  } catch {}
  exportsCache.set(file, info)
  return info
}

function importProblems(file, src) {
  const out = []
  const re = /^\s*import\s+([\w$]+)?\s*,?\s*(?:\{([^}]*)\})?\s*(?:\*\s*as\s+[\w$]+)?\s*from\s*['"]([^'"]+)['"]/gm
  for (const m of src.matchAll(re)) {
    const start = m.index + m[0].search(/\S/)
    const line = lineAt(src, start)
    const spec = m[3]

    if (spec.startsWith('.')) {
      const target = path.resolve(path.dirname(file), spec)
      if (!fs.existsSync(target)) { out.push({ line, msg: `file not found: ${spec}` }); continue }
      if (fs.statSync(target).isDirectory()) { out.push({ line, msg: `${spec} is a folder (ESM needs the full file name)` }); continue }
      if (!/\.m?js$/.test(target)) continue
      const info = exportsOf(target)
      if (!info || info.unknown) continue
      const wanted = []
      if (m[1]) wanted.push('default')
      for (const part of (m[2] || '').split(',')) {
        const n = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
        if (n) wanted.push(n)
      }
      for (const n of wanted) {
        if (info.names.has(n)) continue
        const off = m[0].search(/\S/)
        const at = n === 'default' ? off : Math.max(off, m[0].indexOf(n))
        out.push({ line: lineAt(src, m.index + at), msg: `${path.basename(target)} does not export "${n}"` })
      }
    } else if (!spec.startsWith('node:') && typeof import.meta.resolve === 'function') {
      try { import.meta.resolve(spec) } catch (e) {
        if (e?.code === 'ERR_MODULE_NOT_FOUND' || e?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') out.push({ line, msg: `package "${spec}" is not installed / not exported` })
      }
    }
  }
  return out
}

const nameLine = (src, name) => {
  const i = src.search(new RegExp(`['"\`]${esc(name)}['"\`]`))
  return i < 0 ? null : lineAt(src, i)
}

export default {
  name: 'scan',
  aliases: ['cmdscan', 'doctor'],
  owner: true,
  desc: 'Scan all commands, show which are broken and on which line',
  async run(z) {
    if (/^clear$/i.test(z.text.trim())) {
      expertHub.cmdErrors?.clear()
      return z.reply('🧹 Runtime error log cleared.')
    }
    await z.react('🔎').catch(() => {})

    const all = fs.readdirSync(dir)
    const files = all.filter((f) => f.endsWith('.js') && f !== 'index.js').sort()
    const ignored = all.filter((f) => !f.endsWith('.js') && fs.statSync(path.join(dir, f)).isFile())
    const reg = expertHub.cmdFiles // filled by the loader (commands/index.js)

    const broken = []   // { file, line, msg }
    const warns = []
    const srcs = new Map()

    const checked = await pool(files, 3, async (file) => {
      const full = path.join(dir, file)
      const src = fs.readFileSync(full, 'utf8')
      srcs.set(file, src)
      return { file, src, syn: await syntaxCheck(full) }
    })

    for (const { file, src, syn } of checked) {
      const problems = []
      if (syn) problems.push({ line: syn.line, msg: syn.msg })
      else problems.push(...importProblems(path.join(dir, file), src))

      const rec = reg?.get(file)
      if (!problems.length && rec?.error) {
        const [, line] = (rec.error.where || '').match(/^(?:.*?):(\d+)$/) || []
        const where = rec.error.where && !rec.error.where.endsWith(`commands/${file}:${line}`) ? ` (${rec.error.where})` : ''
        problems.push({ line: line ? Number(line) : null, msg: `failed to load: ${short(rec.error.message)}${where}` })
      }
      if (!problems.length && rec?.skipped) {
        const i = (src.search(/^\s*export\s+default\b/m) + 1 || src.search(/^\s*export\b/m) + 1) - 1
        problems.push({ line: i < 0 ? null : lineAt(src, i + src.slice(i).search(/\S/)), msg: `ignored by the loader — ${rec.skipped}` })
      }
      for (const p of problems) broken.push({ file, ...p })

      if (/\s|\(\d+\)/.test(file)) warns.push(`• ${file} — odd file name (a copy?), rename it`)
    }

    // 4) two files claiming the same command name / alias (the later file wins — files load A→Z)
    const conflicts = []
    if (reg) {
      const owners = new Map()
      for (const [file, r] of reg) {
        if (!r.ok) continue
        for (const n of new Set([r.name, ...r.aliases].map((x) => String(x).toLowerCase()))) {
          if (!owners.has(n)) owners.set(n, [])
          owners.get(n).push(file)
        }
      }
      const groups = new Map()
      for (const [n, fl] of owners) {
        if (fl.length < 2) continue
        const key = fl.join('|')
        if (!groups.has(key)) groups.set(key, { files: fl, names: [] })
        groups.get(key).names.push(n)
      }
      for (const { files: fl, names } of groups.values()) {
        const where = fl.map((f) => `${f}:${nameLine(srcs.get(f) || '', names[0]) ?? '?'}`).join(' vs ')
        conflicts.push(`• ${names.map((n) => '.' + n).join(' ')} — ${where} → ${fl[fl.length - 1]} wins`)
      }
    }

    // 5) errors while running
    const runtime = [...(expertHub.cmdErrors || [])].sort((a, b) => b[1].at - a[1].at).map(
      ([name, e]) => `• .${name} ×${e.count} — ${short(e.message, 90)}${e.where ? ` — ${e.where}` : ''} (${ago(e.at)})`
    )

    const badFiles = new Set(broken.map((b) => b.file)).size
    const lines = [`🔎 *Command scan* — ${files.length} files, ${files.length - badFiles} OK${badFiles ? `, ${badFiles} with problems` : ''}`]

    if (broken.length) {
      lines.push('', `❌ *Broken* (${broken.length})`)
      lines.push(...cap(broken.map((b) => `• commands/${b.file}:${b.line ?? '?'} — ${short(b.msg)}`)))
    }
    if (conflicts.length) lines.push('', `⚠️ *Same name used twice* (${conflicts.length})`, ...cap(conflicts))
    if (warns.length) lines.push('', `⚠️ *Warnings* (${warns.length})`, ...cap(warns))
    if (runtime.length) lines.push('', `💥 *Failed while running* (${runtime.length})`, ...cap(runtime))
    if (ignored.length) lines.push('', `ℹ️ Not loaded (not .js): ${ignored.join(', ')}`)
    if (!reg) lines.push('', 'ℹ️ Load checks are off: replace commands/index.js with the patched one, then restart.')
    if (!broken.length && !conflicts.length && !runtime.length) lines.push('', '✅ No problems found.')
    else if (!runtime.length) lines.push('', '_Runtime errors appear here after a command crashes. `.scan clear` resets them._')

    await z.reply(lines.join('\n'))
  }
}
