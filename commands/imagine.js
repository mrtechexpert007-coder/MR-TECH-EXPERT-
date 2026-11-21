// ⟦EXPERT⟧ .imagine — tengeneza picha kwa prompt ndefu (Pollinations, bure, bila key)
//   .imagine <prompt ndefu>              → picha
//   (reply ujumbe mrefu) .imagine        → inatumia ujumbe uliorepliwa kama prompt
//   .imagine --wide <prompt>             → 16:9   |  --tall → 9:16  |  --square (default)
import axios from 'axios'

const BASE = (process.env.POLLINATIONS_API || 'https://image.pollinations.ai').replace(/\/$/, '')
const MAX_PROMPT = Number(process.env.IMAGINE_MAX_CHARS || 1500) // URL ndefu sana hushindwa; hii ni salama
const MODELS = ['flux', 'turbo']                                  // jaribu flux kwanza, kisha turbo

const SIZES = {
  square: [1024, 1024],
  wide: [1344, 768],
  tall: [768, 1344]
}

function quotedText(msg) {
  const q = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage
  if (!q) return ''
  const m = q.ephemeralMessage?.message || q
  return (m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || '').trim()
}

function clean(s) {
  return s.replace(/\s+/g, ' ').replace(/[#%^<>{}\\|`]/g, ' ').trim()
}

// Prompt ikizidi kikomo, kata mwishoni kwenye mpaka wa sentensi/koma badala ya katikati ya neno
function fit(prompt) {
  if (prompt.length <= MAX_PROMPT) return { text: prompt, cut: false }
  const slice = prompt.slice(0, MAX_PROMPT)
  const stop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(', '), slice.lastIndexOf(' '))
  return { text: slice.slice(0, stop > MAX_PROMPT * 0.6 ? stop : MAX_PROMPT).trim(), cut: true }
}

async function generate(prompt, [w, h], seed) {
  let lastErr
  for (const model of MODELS) {
    try {
      const url = `${BASE}/prompt/${encodeURIComponent(prompt)}`
      const res = await axios.get(url, {
        params: { width: w, height: h, model, seed, nologo: true, enhance: false },
        responseType: 'arraybuffer',
        timeout: 120000,
        headers: { 'User-Agent': 'Mozilla/5.0 (EXPERT-MINI-BOT imagine command)' }
      })
      const buf = Buffer.from(res.data)
      const type = String(res.headers['content-type'] || '')
      if (!type.startsWith('image/') || buf.length < 2000) throw new Error('Jibu si picha')
      return { buf, model }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('Imeshindwa')
}

export default {
  name: 'imagine',
  aliases: ['img', 'image', 'picha', 'gen', 'aiimage'],
  desc: 'Generate an image from a long prompt',
  async run(expert) {
    let raw = expert.text.trim()

    let size = 'square'
    raw = raw.replace(/--(wide|tall|square)\b/i, (_, s) => { size = s.toLowerCase(); return '' }).trim()

    if (!raw) raw = quotedText(expert.msg)
    if (!raw) {
      return expert.reply(
        '🎨 *Matumizi*\n`.imagine <maelezo marefu ya picha>`\nAu reply ujumbe mrefu kisha andika `.imagine`\n\nChaguo: `--wide` (16:9), `--tall` (9:16), `--square`\n\nMfano:\n`.imagine --wide a lone samurai standing on a cliff at sunset, cinematic lighting, detailed armor, misty mountains, 8k`'
      )
    }

    const { text, cut } = fit(clean(raw))
    await expert.react('🎨').catch(() => {})
    try {
      await expert.reply(`⏳ *Natengeneza picha…*${cut ? `\n✂️ Prompt ilikuwa ndefu mno, nimetumia herufi ${text.length} za kwanza.` : ''}`)
      const seed = Math.floor(Math.random() * 1e9)
      const { buf, model } = await generate(text, SIZES[size], seed)

      const caption = `🎨 *${text.length > 200 ? text.slice(0, 200) + '…' : text}*\n🏷️ ${model} • ${SIZES[size].join('×')}\n_EXPERT MINI BOT_`
      await expert.sock.sendMessage(expert.jid, { image: buf, caption }, { quoted: expert.msg })
      await expert.react('✅').catch(() => {})
    } catch (e) {
      console.error('[imagine]', e)
      await expert.reply(`❌ *Imagine failed*\n${String(e.message).slice(0, 300)}\nJaribu tena baada ya muda mfupi.`)
      await expert.react('❌').catch(() => {})
    }
  }
}
