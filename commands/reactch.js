// ⟦EXPERT⟧ .reactch <channel post link> [emoji,emoji,...]
// Every connected linked account reacts once to the channel post (follows the channel first).
import { expertHub } from '../core/expert.hub.js'
import { expertCfg } from '../config/expert.config.js'
import { expertSleep, expertRand, expertPick, expertLog } from '../lib/expert.utils.js'

export default {
  name: 'reactch',
  aliases: ['chreact', 'reactchannel'],
  owner: true,
  desc: 'React to a channel post with every connected account',
  async run(expert) {
    // https://whatsapp.com/channel/<inviteCode>/<postId>
    const m = (expert.args[0] || '').match(/channel\/([\w-]+)\/(\d+)/i)
    if (!m) return expert.reply(`Usage: ${expert.prefix}reactch <channel post link> [🔥,❤️,👍]\n\nOpen the post in the channel → ⋮ → Share → Copy link.`)
    const [, code, serverId] = m

    const custom = (expert.args[1] || '').split(',').map((e) => e.trim()).filter(Boolean)
    const emojis = custom.length ? custom : expertCfg.newsletter.reactions

    // all accounts that are connected right now
    const live = [...expertHub.sessions.values()].filter((s) => s.opened && s.sock?.user)
    if (!live.length) return expert.reply('No connected accounts.')

    let jid
    try {
      const meta = await expert.sock.newsletterMetadata('invite', code)
      jid = meta?.id
    } catch (e) {
      return expert.reply(`❌ Couldn't resolve that channel: ${String(e?.message || e).slice(0, 100)}`)
    }
    if (!jid) return expert.reply('❌ Channel not found.')

    await expert.reply(`⚡ Reacting with ${live.length} connected account${live.length > 1 ? 's' : ''}…`)

    let ok = 0
    for (const s of live) {
      try {
        // must be following to react
        if (!s.followed?.has(jid)) {
          try { await s.sock.newsletterFollow(jid) } catch {}
          s.followed ??= new Set()
          s.followed.add(jid)
          await expertSleep(expertRand(800, 1500))
        }
        await s.sock.newsletterReactMessage(jid, String(serverId), expertPick(emojis))
        ok++
      } catch (e) {
        expertLog.warn(`reactch failed (${s.number}): ${e?.message || e}`)
      }
      await expertSleep(expertRand(1500, 3500)) // stagger so it doesn't look like a bot swarm
    }

    await expert.reply(`✅ ${ok}/${live.length} accounts reacted.`)
  }
}
