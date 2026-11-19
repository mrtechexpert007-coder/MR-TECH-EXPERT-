// ⟦EXPERT⟧ shared engine for antilink / antitag / antigroupmention
// - admins, owner, sudo and the bot itself are NEVER punished
// - modes: warn (delete + warning, kick at limit) · delete (silent delete) · kick (delete + remove instantly)
import { expertGet, expertSet } from './expert.store.js'
import { expertNumber } from './expert.utils.js'
import { expertCfg } from '../config/expert.config.js'
import { expertPIds, expertIsAdm } from './expert.activity.js'
import { expertGuard } from './expert.admin.js'
import { expertLog } from './expert.utils.js'

const DEFAULT_LIMIT = 3
const metaCache = new Map() // jid -> { ts, meta }

async function getMeta(sock, jid) {
  const hit = metaCache.get(jid)
  if (hit && Date.now() - hit.ts < 30_000) return hit.meta
  const meta = await sock.groupMetadata(jid)
  metaCache.set(jid, { ts: Date.now(), meta })
  if (metaCache.size > 200) metaCache.delete(metaCache.keys().next().value)
  return meta
}

/** true when the bot's own account is an admin of the group (needed to delete other people's messages) */
export async function expertBotIsAdmin(sock, jid) {
  try {
    const meta = await getMeta(sock, jid)
    const me = [sock.user?.id, sock.user?.lid].filter(Boolean).map(expertNumber)
    const p = meta.participants.find((x) => expertPIds(x).some((i) => me.includes(i)))
    return expertIsAdm(p)
  } catch { return null } // unknown
}

const nagged = new Map() // jid -> last time we told the group the bot needs admin
async function nagNotAdmin(sock, jid, msg) {
  if (Date.now() - (nagged.get(jid) || 0) < 600_000) return
  nagged.set(jid, Date.now())
  await sock.sendMessage(jid, { text: '⚠️ I can\'t delete messages here because I\'m *not a group admin*. Make this number an admin so the anti-* protections work.' }, { quoted: msg }).catch(() => {})
}

/** true when the sender must be left alone: bot/owner/sudo or a group admin */
export async function expertIsExempt(sock, session, jid, msg) {
  if (msg.key.fromMe) return true
  const ns = session.number
  const ids = [msg.key.participant, msg.key.participantAlt].filter(Boolean).map(expertNumber)
  if (ids.some((i) => [ns, expertCfg.owner, ...expertGet(ns, 'sudo', [])].includes(i))) return true
  try {
    const meta = await getMeta(sock, jid)
    const p = meta.participants.find((x) => expertPIds(x).some((i) => ids.includes(i)))
    return expertIsAdm(p)
  } catch {
    return true // can't verify → don't risk punishing an admin
  }
}

/** delete the message, then apply the configured punishment */
export async function expertPunish(sock, session, jid, msg, feature, reason) {
  const ns = session.number
  const mode = expertGet(ns, `${feature}:mode`, 'warn')
  const limit = expertGet(ns, `${feature}:limit`, DEFAULT_LIMIT)
  const target = msg.key.participant
  const num = expertNumber(msg.key.participantAlt || target)

  try { await sock.sendMessage(jid, { delete: msg.key }) } catch (e) { expertLog.warn(`${feature}: delete failed in ${jid}: ${e?.message || e}`) }
  if ((await expertBotIsAdmin(sock, jid)) === false) { await nagNotAdmin(sock, jid, msg); return }
  if (mode === 'delete' || !target) return

  if (mode === 'kick') {
    await sock.sendMessage(jid, { text: `🚫 @${num} was removed — ${reason}.`, mentions: [target] }).catch(() => {})
    await sock.groupParticipantsUpdate(jid, [target], 'remove').catch(() => {})
    return
  }

  // warn mode — shares the same store as .warn / .warnings / .resetwarn
  const all = expertGet(ns, 'warns', {})
  const grp = (all[jid] ??= {})
  grp[num] = (grp[num] || 0) + 1
  const count = grp[num]
  if (count >= limit) delete grp[num]
  expertSet(ns, 'warns', all)

  if (count >= limit) {
    await sock.sendMessage(jid, { text: `🚫 @${num} reached *${limit}/${limit}* warnings (${reason}) and is being removed.`, mentions: [target] }).catch(() => {})
    await sock.groupParticipantsUpdate(jid, [target], 'remove').catch(() => {})
  } else {
    await sock.sendMessage(jid, { text: `⚠️ *WARNING* @${num}\nReason: ${reason}\nWarnings: *${count}/${limit}*`, mentions: [target] }).catch(() => {})
  }
}

/** builds a command with: on|off|warn|delete|kick|limit <n> (+ optional extra setting) */
export function expertShieldCommand({ name, aliases, desc, label, extra }) {
  return {
    name,
    aliases,
    desc,
    async run(z) {
      if (!(await expertGuard(z))) return
      const ns = z.session.number
      const sub = (z.args[0] || '').toLowerCase()
      const val = z.args[1]

      if (sub === 'on' || sub === 'off') {
        expertSet(ns, name, sub === 'on')
        const warn = sub === 'on' && (await expertBotIsAdmin(z.sock, z.jid)) === false ? '\n\n⚠️ I am *not an admin* in this group yet — make me admin or I cannot delete anything.' : ''
        return z.reply(`🛡️ ${name} is now *${sub.toUpperCase()}* (mode: ${expertGet(ns, `${name}:mode`, 'warn')}).${warn}`)
      }
      if (['warn', 'delete', 'kick'].includes(sub)) {
        expertSet(ns, `${name}:mode`, sub)
        expertSet(ns, name, true)
        const text = { warn: `warn the sender and delete (removed after ${expertGet(ns, `${name}:limit`, DEFAULT_LIMIT)} warnings)`, delete: 'only delete the message', kick: 'delete and remove the sender instantly' }[sub]
        const warn = (await expertBotIsAdmin(z.sock, z.jid)) === false ? '\n\n⚠️ I am *not an admin* in this group yet — make me admin or I cannot delete anything.' : ''
        return z.reply(`🛡️ ${name} is *ON* — will ${text}.${warn}`)
      }
      if (sub === 'limit') {
        const n = parseInt(val, 10)
        if (!n || n < 1 || n > 20) return z.reply(`Usage: .${name} limit <1-20>`)
        expertSet(ns, `${name}:limit`, n)
        return z.reply(`✅ ${name} warning limit set to *${n}*.`)
      }
      if (extra && sub === extra.sub) return extra.run(z, val)

      const on = expertGet(ns, name, false)
      await z.reply(
        `🛡️ *${name}*: ${on ? 'ON' : 'OFF'}\n` +
        `Mode: *${expertGet(ns, `${name}:mode`, 'warn')}* · Limit: *${expertGet(ns, `${name}:limit`, DEFAULT_LIMIT)}*\n` +
        `${label}\n_Admins, owner and sudo are never affected._\n\n` +
        `.${name} on|off\n.${name} warn — delete + warn, kick at limit\n.${name} delete — delete only\n.${name} kick — delete + remove\n.${name} limit <n>` +
        (extra ? `\n${extra.usage}` : '')
      )
    }
  }
    }
