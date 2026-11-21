// ⟦EXPERT⟧ command loader — drop a file in /commands exporting { name, aliases?, run(expert) }
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expertHub, expertWhere } from '../core/expert.hub.js'
import { expertLog } from '../lib/expert.utils.js'

const dir = path.dirname(fileURLToPath(import.meta.url))

export async function expertLoadCommands() {
  expertHub.commands.clear()
  expertHub.cmdFiles = new Map() // file -> { ok, name, aliases } | { ok:false, skipped } | { ok:false, error:{message,where} }  (read by .scan)
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.js') || file === 'index.js') continue
    try {
      const mod = (await import(pathToFileURL(path.join(dir, file)).href)).default
      if (!mod?.name || typeof mod.run !== 'function') {
        expertHub.cmdFiles.set(file, { ok: false, skipped: !mod ? 'no default export' : !mod.name ? 'missing name' : 'missing run()' })
        continue
      }
      expertHub.commands.set(mod.name, mod)
      for (const a of mod.aliases || []) expertHub.commands.set(a, mod)
      expertHub.cmdFiles.set(file, { ok: true, name: mod.name, aliases: [...(mod.aliases || [])] })
    } catch (e) {
      const where = expertWhere(e?.stack)
      expertHub.cmdFiles.set(file, { ok: false, error: { message: String(e?.message || e), where } })
      expertLog.err(`failed to load command ${file}: ${e.message}${where ? ` (${where})` : ''}`)
    }
  }
  const names = [...new Set([...expertHub.commands.values()].map((c) => c.name))]
  expertLog.ok(`commands loaded: ${names.join(', ')}`)
}
