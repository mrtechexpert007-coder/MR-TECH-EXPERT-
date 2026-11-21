// ⟦EXPERT⟧ welcome / goodbye card builder (caption for the group-picture message)

// Bold-italic sans font (𝘼𝘽𝘾 / 𝙖𝙗𝙘) for headings and labels
export function expertFont(str) {
  return [...String(str)].map((ch) => {
    const c = ch.codePointAt(0)
    if (c >= 65 && c <= 90) return String.fromCodePoint(0x1d63c + c - 65)
    if (c >= 97 && c <= 122) return String.fromCodePoint(0x1d656 + c - 97)
    return ch
  }).join('')
}

export const EXPERT_BRAND = 'EXPERT MINI BOT'

const THEMES = {
  welcome: {
    head: `🎉 *${expertFont('WELCOME ABOARD')}* 🎉`,
    who: `👤 ${expertFont('NEW MEMBER')}`,
    foot: `🌟 ${expertFont('Read the rules & enjoy the vibe')}`
  },
  goodbye: {
    head: `👋 *${expertFont('FAREWELL, CHAMP')}* 👋`,
    who: `🚪 ${expertFont('JUST LEFT')}`,
    foot: `🕊️ ${expertFont('Our door is always open')}`
  }
}

const BAR = '▰▱▰▱▰▱▰▱▰▱▰▱'

export function expertCard(kind, { user, group, count, body }) {
  const t = THEMES[kind]
  return [
    `✦ ${BAR} ✦`,
    `   ${t.head}`,
    `✦ ${BAR} ✦`,
    '',
    `${t.who}  ➜  ${user}`,
    `🏠 ${expertFont('GROUP')}  ➜  *${group}*`,
    count ? `🔢 ${expertFont('MEMBERS NOW')}  ➜  *${count}*` : null,
    '',
    `❝ ${body} ❞`,
    '',
    BAR,
    t.foot,
    `   ${EXPERT_BRAND}`
  ].filter((l) => l !== null).join('\n')
}

// Compact boxed reply used by the group-feature commands
export function expertBox(icon, title, lines = []) {
  const body = lines.flatMap((l) => String(l).split('\n')).map((l) => `│ ${l}`)
  return [`╭──〔 ${icon} *${expertFont(title)}* 〕`, ...body, '╰──────────────', `   ${EXPERT_BRAND}`].join('\n')
}
