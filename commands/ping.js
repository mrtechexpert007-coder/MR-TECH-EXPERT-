// ⟦EXPERT⟧ .ping
import fs from 'node:fs'
import os from 'node:os'
import { expertHub } from '../core/expert.hub.js'
import { expertDbPing, expertUsingDb } from '../core/expert.auth.js'
import { expertUptime, expertBytes } from '../lib/expert.utils.js'
import { expertCfg } from '../config/expert.config.js'
import { expertAllStats } from '../lib/expert.servers.js'

const dot = (ms) => (ms < 300 ? '🟢' : ms < 700 ? '🟡' : ms < 1500 ? '🟠' : '🔴')

// Real WhatsApp logo — hosted URL, works with the new readThumb resolver
const WHATSAPP_THUMB = 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg'

// Containers (Railway) report the whole host's RAM; prefer the container's own limit.
function memLimit() {
  for (const f of ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
    try {
      const n = Number(fs.readFileSync(f, 'utf8').trim())
      if (Number.isFinite(n) && n > 0 && n < os.totalmem()) return n
    } catch {}
  }
  return os.totalmem()
}

// WhatsApp timestamps arrive as numbers or protobuf Long objects
function sentAt(ts) {
  const n = typeof ts === 'object' && ts ? (ts.toNumber?.() ?? Number(ts)) : Number(ts)
  return Number.isFinite(n) && n > 0 ? n * 1000 : null
}

export default {
  name: 'ping',
  aliases: ['p'],
  desc: 'Bot speed and server status',
  async run(expert) {
    // how long the incoming command took to reach the bot
    const sent = sentAt(expert.msg.messageTimestamp)
    const age = sent ? Date.now() - sent : null
    const delivery = age !== null && age >= 0 && age < 60_000 ? `${age} ms` : '—'

    // time a real round trip to WhatsApp with a silent reaction
    const t0 = Date.now()
    await expert.sock.sendMessage(expert.jid, { react: { text: '🏓', key: expert.msg.key } })
    const ms = Date.now() - t0

    let db = null
    if (expertUsingDb) {
      try { db = `${await expertDbPing()} ms` } catch { db = '❌ down' }
    }

    const linked = [...expertHub.sessions.values()].filter((s) => s.opened).length
    const all = await expertAllStats().catch(() => null)
    const commands = new Set([...expertHub.commands.values()].map((c) => c.name)).size

    const text = [
      '╭━━━━━━━━━━━━━━━━━━━━╮',
      '┃  🏓 EXPERT MINI BOT  •  PONG*',
      '╰━━━━━━━━━━━━━━━━━━━━╯',
      '',
      '╭──❖ ⚡ *SPEED*',
      `│ ◈ Latency  » *${ms} ms* ${dot(ms)}`,
      `│ ◈ Delivery » *${delivery}*`,
      ...(db ? [`│ ◈ Database » *${db}*`] : []),
      '╰───────────────❖',
      '',
      '╭──❖ 🖥️ *SERVER*',
      `│ ◈ Uptime » *${expertUptime(process.uptime())}*`,
      `│ ◈ RAM    » *${expertBytes(process.memoryUsage().rss)}* / ${expertBytes(memLimit())}`,
      `│ ◈ Node   » *${process.version}*`,
      '╰───────────────❖',
      '',
      '╭──❖ 👥 *PEOPLE CONNECTED*',
      ...(all
        ? [`│ ◈ Total  » *${all.total}* people`, `│ ◈ Online » *${all.online}* now`, `│ ◈ Servers » *${all.reachable}/${all.count}*`]
        : [`│ ◈ This server » *${linked}* online`]),
      '╰───────────────❖',
      '',
      `✦ *${linked}* accounts here  ✦  *${commands}* commands`
    ].join('\n')

    await expert.buttons({
      image: WHATSAPP_THUMB,
      header: {
        title: 'WhatsApp',
        subtitle: 'Ping · Pong',
        thumb: WHATSAPP_THUMB
      },
      text,
      buttons: [{ url: expertCfg.channelUrl, text: '📢 VIEW CHANNEL' }]
    })
  }
}
