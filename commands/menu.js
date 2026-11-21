// ⟦EXPERT⟧ .menu — AURA MENU
// 100% automatic: count and list come from the loaded commands — nothing to edit here.
// A new command is placed by (1) its own `category` field (ai|media|fun|shield|group|lore|stats|tools|system),
// (2) the REALMS lists below, (3) name/description guessing, (4) ✨ EXTRAS as the last resort.

import { expertHub } from '../core/expert.hub.js'
import { expertCfg } from '../config/expert.config.js'
import { expertFont } from '../lib/expert.frame.js'
import { expertUptime } from '../lib/expert.utils.js'

const BOT_NAME = 'EXPERT MINI BOT'
const BOT_TAGLINE = 'Small Name. Unlimited Power.'

// Read more: herufi zisizoonekana zinazofanya WhatsApp ikate ujumbe
// Kama haifanyi kazi jaribu: '\u200B'.repeat(4001)
const READ_MORE = String.fromCharCode(8206).repeat(4001)

// ── realms: icon, title, command names ──────────────────────
const REALMS = [
  { icon: '🧠', key: 'ai', title: 'AI REALM', cmds: ['ai', 'claude', 'gemini', 'aio'] },
  {
    icon: '📥', key: 'media', title: 'MEDIA VAULT',
    cmds: ['play', 'playvideo', 'download', 'tourl', 'toimage', 'toaudio', 'sticker', 'tts', 'qr', 'getpp', 'savestatus', 'vv']
  },
  {
    icon: '🎮', key: 'fun', title: 'FUN ARENA',
    cmds: ['ttt', '8ball', 'dice', 'flip', 'joke', 'fact', 'quote', 'poll', 'giveaway']
  },
  {
    icon: '🛡️', key: 'shield', title: 'SHIELD CORE',
    cmds: [
      'antilink', 'antibadword', 'antibug', 'antidelete', 'antiedit', 'antitag', 'antimention', 'antigroupmention', 'antisticker', 'antigroupstatus', 'antibot',
      'antipromote', 'antidemote', 'anticall', 'mediaonly', 'textonly', 'lock', 'unlock', 'slowmode',
      'mute', 'unmute', 'warn', 'warnings', 'resetwarn', 'jail', 'unjail', 'ban', 'unban', 'bancheck', 'bannido', 'delayperma'
    ]
  },
  {
    icon: '👑', key: 'group', title: 'GROUP COMMAND',
    cmds: [
      'add', 'kick', 'votekick', 'promote', 'demote', 'tagall', 'tagadmins', 'hidetag', 'membertag',
      'welcome', 'goodbye', 'groupname', 'groupdesc', 'grouplink', 'resetgrouplink', 'setgrouppic',
      'invite', 'announce', 'closetime', 'ephemeral', 'pin', 'timezonegroup', 'groupstatus'
    ]
  },
  {
    icon: '📜', key: 'lore', title: 'GROUP LORE',
    cmds: [
      'rules', 'setrules', 'groupnotice', 'groupfaq', 'adminnotes', 'groupinfo', 'listadmins', 'membercount',
      'memberroles', 'groupbackup', 'grouprestore', 'groupcalendar', 'event', 'birthday', 'requests', 'report'
    ]
  },
  {
    icon: '📊', key: 'stats', title: 'PULSE & STATS',
    cmds: ['topchatters', 'groupstats', 'grouprecap', 'activity', 'listactive', 'inactive', 'streak', 'afk', 'peek']
  },
  {
    icon: '🧰', key: 'tools', title: 'POWER TOOLS',
    cmds: [
      'calc', 'translate', 'define', 'weather', 'currency', 'crypto', 'livescore', 'time',
      'bible', 'quran', 'vowel', 'shorten', 'password', 'base64', 'remind', 'note', 'jid', 'checkwa', 'github', 'channel', 'inspect'
    ]
  },
  {
    icon: '⚙️', key: 'system', title: 'CORE SYSTEM',
    cmds: [
      'ping', 'alive', 'runtime', 'owner', 'mode', 'settings', 'setprefix', 'setbio', 'setpp', 'setprofilename',
      'autobio', 'autoreact', 'autoread', 'autotyping', 'autorecording', 'alwaysonline', 'pair', 'listpair', 'sudo', 'block', 'unblock',
      'broadcast', 'join', 'leave', 'groups', 'grouppost', 'restart', 'update', 'chatbot'
    ]
  }
]

// The name "twinkles": every time the menu is opened the sparkles around it change.
const SPARK_LINES = [
  '✧･ﾟ: *✧･ﾟ:*  ⟡  *:･ﾟ✧*:･ﾟ✧',
  '✦･ﾟ: *✦･ﾟ:*  ✧  *:･ﾟ✦*:･ﾟ✦',
  '⋆｡°✩ ⋆｡°✩  ⟡  ✩°｡⋆ ✩°｡⋆',
  '･ﾟ✧ *･ﾟ✧*  ✦  *✧ﾟ･* ✧ﾟ･'
]
const GLOW_SETS = [['✨', '💫', '⭐'], ['💫', '🌟', '✨'], ['⭐', '✨', '🌟'], ['🌟', '⭐', '💫']]
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const RULE = '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Africa/Dar_es_Salaam' }).format(new Date())) % 24
  if (h < 5) return ['🌌', 'Night Owl']
  if (h < 12) return ['🌅', 'Good Morning']
  if (h < 17) return ['☀️', 'Good Afternoon']
  if (h < 21) return ['🌇', 'Good Evening']
  return ['🌙', 'Good Night']
}

// Guess a realm for commands nobody placed by hand (keeps new files out of EXTRAS when it is obvious)
function guessRealm(name, c) {
  const d = String(c?.desc || '')
  if (/^anti/.test(name)) return 'shield'
  if (/^auto/.test(name)) return 'system'
  if (/^group/.test(name)) return 'group'
  if (/^sticker/.test(name)) return 'media'
  if (/\b(download|tiktok|instagram|facebook|youtube|video|audio|lyrics|image|photo)\b/i.test(d)) return 'media'
  if (/\b(AI|GPT|Gemini|Claude|chatbot)\b/.test(d)) return 'ai'
  return null
}

const realmKey = (v) => {
  const k = String(v || '').toLowerCase().trim()
  return REALMS.find((r) => r.key === k || r.title.toLowerCase() === k)?.key || null
}

function realm(icon, title, tags, tail = '') {
  return [
    `╭─❖ ${icon} *${expertFont(title)}* ❖${tail}`,
    ...tags.map((r) => `│ ${r}`),
    '╰─────────────⟡'
  ].join('\n')
}

export default {
  name: 'menu',
  aliases: ['help', 'commands'],
  desc: 'Display the EXPERT MINI BOT aura menu',

  async run(expert) {
    const prefix = expert.prefix || '.'

    // unique loaded commands (aliases collapsed), menu itself hidden
    const all = new Map()
    for (const c of expertHub.commands.values()) if (c.name !== 'menu') all.set(c.name, c)
    const total = all.size

    const tag = (name) => `✦ ${prefix}${name}${all.get(name)?.owner ? '👑' : ''}`

    // ── auto-placement: own `category` → hand-made lists → guess → EXTRAS ──
    const listedIn = new Map()
    REALMS.forEach((r) => r.cmds.forEach((n) => { if (!listedIn.has(n)) listedIn.set(n, r.key) }))
    const byRealm = new Map(REALMS.map((r) => [r.key, []]))
    const extras = []
    for (const [name, c] of all) {
      const key = realmKey(c.category) || listedIn.get(name) || guessRealm(name, c)
      if (key) byRealm.get(key).push(name)
      else extras.push(name)
    }
    extras.sort()

    const blocks = []
    for (const r of REALMS) {
      const names = byRealm.get(r.key).sort((x, y) => {
        const ix = r.cmds.indexOf(x), iy = r.cmds.indexOf(y)
        return (ix < 0 ? 1e9 : ix) - (iy < 0 ? 1e9 : iy) || x.localeCompare(y)
      })
      if (!names.length) continue
      blocks.push(realm(r.icon, r.title, names.map(tag), ` _${names.length}_`))
    }
    if (extras.length) blocks.push(realm('✨', 'EXTRAS', extras.map(tag), ` _${extras.length}_`))

    const [emoji, hello] = greeting()
    const now = new Intl.DateTimeFormat('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Africa/Dar_es_Salaam'
    }).format(new Date())
    const mode = String(expert.mode ?? 'public').toUpperCase()
    const owner = expert.session?.number ?? 'Connected'
    const up = expertUptime(process.uptime())

    // Juu (inaonekana kwanza) + READ_MORE + orodha kamili (inafunguka ukigusa)
    const SPARK = pick(SPARK_LINES)
    const [g1, g2, g3] = pick(GLOW_SETS)
    const finalText = [
      SPARK,
      `${g1}${g2}${g3}  *${expertFont(BOT_NAME)}*  ${g3}${g2}${g1}`,
      SPARK,
      '',
      `${emoji} *${expertFont(hello)}* — ${expertFont('your aura is loaded')} 🔮`,
      '',
      `╭─❖ 🔮 *${expertFont('AURA STATUS')}* ❖`,
      `│ ◈ ${expertFont('Mode')}     ➜ *${mode}*`,
      `│ ◈ ${expertFont('Prefix')}   ➜ *${prefix}*`,
      `│ ◈ ${expertFont('Owner')}    ➜ *${owner}*`,
      `│ ◈ ${expertFont('Uptime')}   ➜ *${up}*`,
      `│ ◈ ${expertFont('Time')}     ➜ *${now}*`,
      `│ ◈ ${expertFont('Powers')}   ➜ *${total}*`,
      '╰─────────────⟡',
      '',
      `📚 *${expertFont('Command List')}*`,
      READ_MORE,
      RULE,
      ...blocks.flatMap((b) => [b, '']),
      RULE,
      '',
      `👑 ${expertFont('= owner only')}   💡 ${expertFont('Try')} ➜ *${prefix}ping*`,
      '',
      `⚡ ${expertFont(BOT_TAGLINE)}`,
      `   ${g1} *${expertFont(BOT_NAME)}* ${g1}`
    ].join('\n')

    // Namba ya owner kwa batani ya HELP (wa.me), au link maalum kupitia HELP_URL
    const ownerNum = String(expertCfg.owners?.[0] || expert.session?.number || '').replace(/\D/g, '')
    const helpUrl = process.env.HELP_URL || expertCfg.helpUrl || (expertCfg.helpNumber ? `https://wa.me/${expertCfg.helpNumber}` : null) || (ownerNum ? `https://wa.me/${ownerNum}` : null)

    // Buttons fupi na nadhifu: Channel, Help, Connect Bot
    const buttons = [
      { url: expertCfg.channelUrl, text: 'Channel' },
      helpUrl ? { url: helpUrl, text: 'Help' } : { id: `${prefix}owner`, text: 'Help' },
      { id: `${prefix}connect`, text: 'Connect Bot' }
    ]

    return expert.buttons({
      header: { thumb: expertCfg.menuThumb, title: BOT_NAME, subtitle: BOT_TAGLINE },
      image: expertCfg.menuImage, // ondoa mstari huu kama Read more haionekani
      text: finalText,
      buttons
    })
  }
    }
