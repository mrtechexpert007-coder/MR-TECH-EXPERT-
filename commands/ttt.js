// ⟦EXPERT⟧ .ttt — Tic-Tac-Toe
//   .ttt @user      challenge someone (or reply to them)      .ttt accept / decline
//   .ttt bot        play against the bot                        .ttt 5   (or just send "5" in a group)
//   .ttt end        stop the game (players or admins)           .ttt top  leaderboard
import { expertTargets, expertGroup } from '../lib/expert.admin.js'
import { expertAliases, expertIsBot, expertPIds } from '../lib/expert.activity.js'
import { expertNumber } from '../lib/expert.utils.js'
import { expertBox } from '../lib/expert.frame.js'
import { tttGet, tttCreate, tttEnd, tttPlay, tttShow, tttTop } from '../lib/expert.ttt.js'

const HELP = (p) =>
  `${p}ttt @user — challenge someone\n${p}ttt bot — play the bot\n${p}ttt accept | decline\n${p}ttt <1-9> — your move (groups: just send the number)\n${p}ttt end — stop the game\n${p}ttt top — leaderboard`

export default {
  name: 'ttt',
  aliases: ['tictactoe'],
  desc: 'Tic-Tac-Toe: .ttt @user · .ttt bot · .ttt accept · .ttt <1-9> · .ttt end · .ttt top',
  async run(z) {
    const ns = z.session.number
    const sub = (z.args[0] || '').toLowerCase()
    const mine = new Set(await expertAliases(z, z.sender))
    if (z.msg.key.participantAlt) mine.add(expertNumber(z.msg.key.participantAlt))
    const ids = [...mine]
    const me = { jid: z.sender, ids }
    const g = tttGet(ns, z.jid)

    // ── move ──
    if (/^[1-9]$/.test(sub)) {
      const r = await tttPlay(z.sock, ns, z.jid, z.msg, ids, +sub - 1)
      if (r === 'nogame') return z.reply(`No game running here. Start one: ${z.prefix}ttt @user or ${z.prefix}ttt bot`)
      if (r === 'notplayer') return z.reply('👀 You\'re not playing in this game.')
      if (r === 'notturn') return z.reply('⏳ Not your turn.')
      if (r === 'taken') return z.reply('🚫 That square is taken — pick another number.')
      return
    }

    if (sub === 'top') {
      const top = tttTop(ns, z.jid)
      if (!top.length) return z.reply('🏆 No finished games here yet.')
      return z.sock.sendMessage(z.jid, {
        text: expertBox('🏆', 'TTT LEADERBOARD', top.map((r, i) => `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} @${expertNumber(r.jid)} — ${r.w}W ${r.l}L ${r.d}D`)),
        mentions: top.map((r) => r.jid)
      }, { quoted: z.msg })
    }

    if (sub === 'end' || sub === 'quit' || sub === 'stop') {
      if (!g) return z.reply('No game is running.')
      const player = g.x.ids.some((i) => ids.includes(i)) || (g.o !== 'bot' && g.o.ids.some((i) => ids.includes(i)))
      const admin = z.isGroup ? (await expertGroup(z)).senderAdmin : true
      if (!player && !admin) return z.reply('⛔ Only the players or a group admin can end the game.')
      tttEnd(ns, z.jid)
      return z.reply('🛑 Game ended.')
    }

    if (sub === 'accept' || sub === 'decline') {
      if (!g || g.state !== 'pending') return z.reply('No pending challenge for you.')
      if (!g.o.ids.some((i) => ids.includes(i))) return z.reply('That challenge isn\'t for you.')
      if (sub === 'decline') { tttEnd(ns, z.jid); return z.reply('🙅 Challenge declined.') }
      g.state = 'playing'
      g.last = Date.now()
      return tttShow(z.sock, z.jid, g, z.msg)
    }

    // ── start a game ──
    if (g) return z.reply(`🎮 A game is already running here. ${g.state === 'pending' ? 'Waiting for the challenge to be accepted.' : `Send a number 1-9, or ${z.prefix}ttt end.`}`)

    if (sub === 'bot') {
      const game = tttCreate(ns, z.jid, me, 'bot', 'playing')
      return tttShow(z.sock, z.jid, game, z.msg, ['You are ❌ and go first.'])
    }

    const target = expertTargets(z)[0]
    if (!target) return z.reply(expertBox('⭕', 'TIC TAC TOE', HELP(z.prefix).split('\n')))
    if (!z.isGroup) return z.reply('👥 Challenging a person works in groups. Here you can play the bot: .ttt bot')
    const meta = await z.sock.groupMetadata(z.jid)
    const tnum = expertNumber(target)
    const p = meta.participants.find((x) => expertPIds(x).includes(tnum))
    if (!p) return z.reply('⚠️ That person is not in this group.')
    if (expertIsBot(z, p)) return z.reply('🤖 Want to play me? Use .ttt bot')
    if (expertPIds(p).some((i) => ids.includes(i))) return z.reply('😅 You can\'t challenge yourself.')
    const opp = { jid: p.phoneNumber || p.id, ids: expertPIds(p) }
    const game = tttCreate(ns, z.jid, me, opp, 'pending')
    await z.sock.sendMessage(z.jid, {
      text: expertBox('⭕', 'TIC TAC TOE', [`@${expertNumber(z.sender)} challenges @${expertNumber(opp.jid)}!`, '', `${z.prefix}ttt accept  or  ${z.prefix}ttt decline`, '_Expires in 2 minutes._']),
      mentions: [z.sender, opp.jid]
    }, { quoted: z.msg })
  }
}
