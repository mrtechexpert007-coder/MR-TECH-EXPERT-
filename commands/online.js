// ⟦EXPERT⟧ .online [sekunde] [tag] — orodha ya wanachama wa group walio online sasa hivi
// Inajisajili kwenye "presence" ya kila mwanachama na kusikiliza majibu kwa sekunde chache.
import { expertPIds, expertMention } from '../lib/expert.activity.js'
import { expertNumber } from '../lib/expert.utils.js'

const LIVE = new Set(['available', 'composing', 'recording'])
const MAX_SUBS = 400          // max members checked per run (protects the account from rate limits)
const SUB_DELAY = 30          // ms between subscriptions
const DEF_SECS = 8
const MIN_SECS = 3
const MAX_SECS = 20
const COOLDOWN = 30_000       // per group
const MAX_LIST = 100

const cooldown = new Map()    // `${number}|${jid}` -> last run
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export default {
  name: 'online',
  aliases: ['whoonline', 'walioonline', 'onlinelist'],
  desc: 'List group members who are online right now. Usage: .online [sekunde] [tag]',
  async run(z) {
    if (!z.isGroup) return z.reply('👥 Groups only.')

    const key = `${z.session.number}|${z.jid}`
    const wait = COOLDOWN - (Date.now() - (cooldown.get(key) || 0))
    if (wait > 0) return z.reply(`⏳ Subiri sekunde *${Math.ceil(wait / 1000)}* kisha jaribu tena.`)
    cooldown.set(key, Date.now())
    if (cooldown.size > 500) cooldown.delete(cooldown.keys().next().value)

    const tag = z.args.some((a) => a.toLowerCase() === 'tag')
    const asked = z.args.map(Number).find((n) => Number.isFinite(n))
    const secs = Math.min(MAX_SECS, Math.max(MIN_SECS, Math.round(asked ?? DEF_SECS)))

    const meta = z.groupMeta || await z.sock.groupMetadata(z.jid)
    const ownNums = [z.session.number, z.sock.user?.id, z.sock.user?.lid].filter(Boolean).map(expertNumber)
    const members = meta.participants.filter((p) => !expertPIds(p).some((i) => ownNums.includes(i)))
    if (!members.length) return z.reply('🤷 Hakuna wanachama wa kuangalia.')

    // any id a member is known by (phone / lid) → the member
    const byNum = new Map()
    for (const p of members) for (const id of expertPIds(p)) byNum.set(id, p)

    const state = new Map() // member -> latest presence
    const onPresence = ({ presences }) => {
      for (const [jid, info] of Object.entries(presences || {})) {
        const p = byNum.get(expertNumber(jid))
        if (p && info?.lastKnownPresence) state.set(p, info.lastKnownPresence)
      }
    }

    const checked = Math.min(members.length, MAX_SUBS)
    await z.reply(`🔍 Naangalia walioonline (*${checked}* wanachama)... subiri sekunde ~${secs + Math.ceil((checked * SUB_DELAY) / 1000)}.`)

    z.sock.ev.on('presence.update', onPresence)
    try {
      for (const p of members.slice(0, MAX_SUBS)) {
        try { await z.sock.presenceSubscribe(expertMention(p)) } catch {}
        await sleep(SUB_DELAY)
      }
      await sleep(secs * 1000)
    } finally {
      z.sock.ev.off('presence.update', onPresence)
    }

    // the person who typed the command is obviously online
    const me = byNum.get(expertNumber(z.sender))
    if (me && !LIVE.has(state.get(me))) state.set(me, 'available')

    const online = [...state].filter(([, s]) => LIVE.has(s)).map(([p, s]) => ({ p, s }))
    if (!online.length) {
      return z.reply(`😴 Sijaona mtu yeyote online sasa hivi.\n\n_Wanaoficha "online" kwenye privacy hawaonekani._`)
    }

    const num = ({ p }) => expertNumber(expertMention(p))
    const mark = ({ s }) => (s === 'composing' ? ' ✍️' : s === 'recording' ? ' 🎙️' : '')
    const shown = online.slice(0, MAX_LIST)
    const lines = shown.map((o, i) => `${i + 1}. ${tag ? '@' : '+'}${num(o)}${mark(o)}`)
    const more = online.length > shown.length ? `\n…na wengine ${online.length - shown.length}` : ''

    await z.sock.sendMessage(z.jid, {
      text:
        `🟢 *WALIOONLINE* — ${meta.subject}\n` +
        `Jumla: *${online.length}* kati ya ${checked}\n\n${lines.join('\n')}${more}\n\n` +
        `_Wanaoficha "online" kwenye privacy hawaonekani, na orodha ni ya sekunde hizi ${secs} tu._`,
      mentions: tag ? shown.map((o) => expertMention(o.p)) : []
    }, { quoted: z.msg })
  }
                                             }
