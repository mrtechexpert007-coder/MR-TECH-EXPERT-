// ⟦EXPERT⟧ settings store — in-memory, written through to Postgres (or a JSON file without a DB)
// Writes are debounced: many expertSet() calls inside a short window become ONE write.
import fs from 'node:fs'
import path from 'node:path'
import { expertCfg } from '../config/expert.config.js'
import { expertKvAll, expertKvPut, expertUsingDb } from '../core/expert.auth.js'

const file = path.join(expertCfg.root, 'storage', 'settings.json')
const WRITE_DELAY_MS = 2000
let db = {}
const dirtyNs = new Set()
let timer = null
let writing = Promise.resolve()

export async function expertStoreInit() {
  if (expertUsingDb) db = (await expertKvAll()) || {}
  else { try { db = JSON.parse(fs.readFileSync(file, 'utf8')) } catch {} }
}

export const expertGet = (ns, key, def) => db[ns]?.[key] ?? def

function schedule(ns) {
  dirtyNs.add(ns)
  if (timer) return
  timer = setTimeout(() => { timer = null; expertStoreFlush().catch(() => {}) }, WRITE_DELAY_MS)
  timer.unref?.()
}

// Writes everything pending. Safe to call anytime (also on shutdown).
export function expertStoreFlush() {
  if (timer) { clearTimeout(timer); timer = null }
  const namespaces = [...dirtyNs]
  dirtyNs.clear()
  if (!namespaces.length) return writing
  writing = writing.then(async () => {
    if (expertUsingDb) {
      for (const ns of namespaces) await expertKvPut(ns, db[ns])
      return
    }
    await fs.promises.mkdir(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    await fs.promises.writeFile(tmp, JSON.stringify(db)) // compact: much faster than pretty-print
    await fs.promises.rename(tmp, file)                  // atomic: no half-written settings.json
  }).catch(() => {})
  return writing
}

// Last-chance sync save for file mode if the process exits abruptly.
process.on('exit', () => {
  if (expertUsingDb || !dirtyNs.size) return
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(db))
  } catch {}
})

export function expertSet(ns, key, val) {
  (db[ns] ??= {})[key] = val
  schedule(ns)
}
