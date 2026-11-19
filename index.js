// ⟦EXPERT⟧ NEXUS-MD — entry point
import './lib/expert.quiet.js' // must stay first: hides Signal key dumps from the logs
import { expertCfg } from './config/expert.config.js'
import { expertHub, EXPERT_SIG } from './core/expert.hub.js'
import { expertLoadCommands } from './commands/index.js'
import { expertServe } from './core/expert.pair.js'
import { expertResumeAll } from './core/expert.sock.js'
import { expertAuthInit } from './core/expert.auth.js'
import { expertStoreInit, expertStoreFlush } from './lib/expert.store.js'
import { expertLog } from './lib/expert.utils.js'
import { expertStartAutoUpdate } from './lib/expert.updater.js'

if (expertHub.sig !== EXPERT_SIG) throw new Error('EXPERT signature missing — core tampered')

console.log(`
  ╔══════════════════════════════╗
  ║   𝙿𝚁𝙸𝙽𝙲𝙴 𝙼𝙸𝙽𝙸           ║
  ║   ⓅⓇⒾⓃⒸⒺ      ║
  ╚══════════════════════════════╝
`)

const ignorable = ['Connection Closed', 'Timed Out', 'rate-overlimit', 'item-not-found', 'Socket connection timeout']
process.on('unhandledRejection', (r) => { if (!ignorable.some((e) => String(r).includes(e))) expertLog.err('unhandledRejection:', r) })
process.on('uncaughtException', (e) => { if (!ignorable.some((x) => String(e).includes(x))) expertLog.err('uncaughtException:', e?.stack || e) })

for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, async () => { expertLog.warn(`${sig} — bye`); await Promise.race([expertStoreFlush(), new Promise((r) => setTimeout(r, 3000))]); process.exit(0) })

await expertAuthInit()
await expertStoreInit()
await expertLoadCommands()
expertServe()
await expertResumeAll()
expertStartAutoUpdate()
expertLog.ok(`${expertCfg.botName} ready`)
