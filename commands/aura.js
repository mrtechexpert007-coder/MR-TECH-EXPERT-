// ⟦EXPERT⟧ .aura [@user] — today's aura reading
import { expertRand, expertPick } from '../lib/expert.utils.js'
import { expertFont, EXPERT_BRAND } from '../lib/expert.frame.js'
import { expertTargets } from '../lib/expert.admin.js'

const TIERS = [
  { max: 10, title: 'GHOST MODE', emoji: '👻', note: 'invisible today — low battery, high mystery.' },
  { max: 25, title: 'STATIC', emoji: '📉', note: 'a bit off. drink water, touch grass, reboot.' },
  { max: 45, title: 'STEADY', emoji: '🌥️', note: 'nothing special, nothing wrong. holding the line.' },
  { max: 65, title: 'GLOWING', emoji: '🌤️', note: 'people can feel it. keep this energy.' },
  { max: 85, title: 'RADIANT', emoji: '✨', note: 'main character behavior unlocked.' },
  { max: 97, title: 'LEGENDARY', emoji: '🔥', note: 'untouchable. the room changes when you walk in.' },
  { max: 100, title: 'ASCENDED', emoji: '👑', note: 'this is not a bug. the simulation is afraid of you.' }
]

const COLORS = ['Violet', 'Crimson', 'Gold', 'Obsidian', 'Jade', 'Azure', 'Rose Quartz', 'Silver', 'Amber', 'Indigo']
const TRAITS = ['dangerously confident', 'quietly powerful', 'chaotic good', 'unreasonably charming', 'built different', 'running on pure vibes', 'immune to red flags', 'allergic to mediocrity']

function barFor(score) {
  const filled = Math.round(score / 5)
  return '█'.repeat(filled) + '░'.repeat(20 - filled)
}

export default {
  name: 'aura',
  aliases: ['auracheck', 'vibecheck'],
  desc: "Read today's aura score (yours or @someone's)",

  async run(z) {
    const target = expertTargets(z)[0] || z.sender
    const who = target === z.sender ? 'You' : `@${target.split('@')[0].split(':')[0]}`

    // stable per day+person so repeated checks today give the same reading
    const day = new Date().toISOString().slice(0, 10)
    let h = 0
    for (const ch of `${day}:${target}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    const score = h % 101

    const tier = TIERS.find((t) => score <= t.max)
    const color = COLORS[h % COLORS.length]
    const trait = TRAITS[(h >>> 3) % TRAITS.length]

    const text = [
      `╭──〔 🔮 *${expertFont('AURA READING')}* 〕`,
      `│ ${who}`,
      '│',
      `│ ${tier.emoji} *${expertFont(tier.title)}*  —  *${score}/100*`,
      `│ [${barFor(score)}]`,
      '│',
      `│ 🎨 Aura color: *${color}*`,
      `│ ⚡ Energy: *${trait}*`,
      `│ 📜 ${tier.note}`,
      '╰──────────────',
      `   ${EXPERT_BRAND}`
    ].join('\n')

    await z.sock.sendMessage(z.jid, { text, mentions: [target] }, { quoted: z.msg })
  }
}
