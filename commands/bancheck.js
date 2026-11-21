// ⟦EXPERT⟧ .bancheck / .wacheck — check if a number is on WhatsApp
// Uses Baileys sock.onWhatsApp (session-based).
// Note: WhatsApp does NOT expose a public “banned” flag.
// A banned account usually returns the same as “not registered”.
// Results: ACTIVE | NOT FOUND (unregistered or banned) | ERROR

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '')
}

function normalizeNumber(raw, defaultCc = '234') {
  let d = digitsOnly(raw)
  if (!d) return null
  // strip leading 00
  if (d.startsWith('00')) d = d.slice(2)
  // local NG style 0xxxxxxxxxx → 234xxxxxxxxxx
  if (d.length === 11 && d.startsWith('0') && defaultCc === '234') {
    d = defaultCc + d.slice(1)
  }
  // bare 10-digit NG without leading 0
  if (d.length === 10 && defaultCc === '234') {
    d = defaultCc + d
  }
  if (d.length < 8 || d.length > 15) return null
  return d
}

function parseTargets(expert) {
  const out = []
  const text = String(expert.text || '').trim()
  const mentioned =
    expert.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
    expert.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
    []

  for (const jid of mentioned) {
    const n = digitsOnly(String(jid).split('@')[0])
    if (n) out.push(n)
  }

  // reply participant
  const ctx = expert.msg.message?.extendedTextMessage?.contextInfo
  if (ctx?.participant) {
    const n = digitsOnly(String(ctx.participant).split('@')[0])
    // only if no text number and it's a reply without other args? optional
  }

  if (text) {
    // split by space / comma / newline
    for (const part of text.split(/[\s,;]+/)) {
      const n = normalizeNumber(part)
      if (n) out.push(n)
    }
  }

  // unique
  return [...new Set(out)]
}

async function checkOne(sock, number) {
  const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`
  const result = {
    number,
    jid: null,
    exists: false,
    status: 'NOT_FOUND',
    detail: 'Not registered on WhatsApp — or the account is banned / restricted'
  }

  try {
    // Baileys: onWhatsApp accepts number or jid; returns array
    let res = await sock.onWhatsApp(number)
    if (!Array.isArray(res)) res = res ? [res] : []
    const hit = res.find((r) => r && (r.exists || r.jid)) || res[0]

    if (hit?.exists || hit?.jid) {
      result.exists = true
      result.jid = hit.jid || jid
      result.status = 'ACTIVE'
      result.detail = 'Number is registered and reachable on WhatsApp'
    }

    // Optional: profile picture as extra signal (active accounts often have one)
    if (result.exists) {
      try {
        const pp = await sock.profilePictureUrl(result.jid, 'image')
        result.profilePic = pp || null
      } catch {
        result.profilePic = null
        // no PP is normal (privacy) — still ACTIVE
      }

      try {
        const [status] = (await sock.fetchStatus?.(result.jid)) || []
        if (status?.status) result.about = String(status.status).slice(0, 80)
      } catch {
        /* optional */
      }
    }
  } catch (e) {
    result.status = 'ERROR'
    result.detail = e.message || String(e)
  }

  return result
}

export default {
  name: 'bancheck',
  aliases: ['wacheck', 'checkwa', 'checkban', 'waban'],
  desc: 'Check if a WhatsApp number is active / not found (possible ban)',
  async run(expert) {
    const targets = parseTargets(expert)

    if (!targets.length) {
      return expert.reply(
        '🔍 *WhatsApp Check*\n\n' +
          'Usage:\n' +
          '• `.bancheck 2348012345678`\n' +
          '• `.bancheck 08012345678` (NG local ok)\n' +
          '• `.bancheck @user` (mention)\n' +
          '• `.bancheck 234xxx 234yyy` (max 5)\n\n' +
          '_Note: WhatsApp does not publish a public ban flag.\n' +
          'Banned numbers usually look the same as “not on WhatsApp”._'
      )
    }

    if (targets.length > 5) {
      return expert.reply('⚠️ Max *5* numbers per check (protects your session).')
    }

    await expert.react('🔍').catch(() => {})
    await expert.reply(`⏳ Checking *${targets.length}* number(s)…`).catch(() => {})

    const lines = []
    for (const num of targets) {
      const r = await checkOne(expert.sock, num)
      const icon =
        r.status === 'ACTIVE' ? '✅' : r.status === 'ERROR' ? '⚠️' : '🚫'
      lines.push(
        `${icon} *+${r.number}*\n` +
          `   Status » *${r.status}*\n` +
          `   ${r.detail}` +
          (r.jid ? `\n   JID » \`${r.jid}\`` : '') +
          (r.about ? `\n   About » ${r.about}` : '')
      )
      // small delay between checks to reduce rate flags
      if (targets.length > 1) {
        await new Promise((res) => setTimeout(res, 800))
      }
    }

    const text =
      `🔍 *WhatsApp Status Check*\n\n` +
      lines.join('\n\n') +
      `\n\n_ACTIVE = on WhatsApp\n` +
      `NOT_FOUND = unregistered *or* banned (WA hides the difference)\n` +
      `Do not bulk-check — risk to *your* session._\n` +
      `_EXPERT MINI BOT_`

    await expert.reply(text)
    await expert.react('✅').catch(() => {})
  }
}
