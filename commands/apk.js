// ⟦EXPERT⟧ .apk <app name> — download an Android app (APK) from the Aptoide store
// Examples:  .apk whatsapp      .apk -l tiktok  (list top results instead of downloading)
const API = 'https://ws75.aptoide.com/api/7/apps/search'
const MAX_BYTES = 100 * 1024 * 1024 // WhatsApp document limit is ~100 MB

const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

async function search(query, limit = 5) {
  const url = `${API}?query=${encodeURIComponent(query)}&limit=${limit}`
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) })
  if (!r.ok) throw new Error(`Search failed (HTTP ${r.status})`)
  const j = await r.json()
  return (j?.datalist?.list || []).filter((a) => a?.file?.path && a?.package)
}

const info = (a) => {
  const size = a.file?.filesize || a.size || 0
  return {
    name: a.name,
    pkg: a.package,
    version: a.file?.vername || '?',
    size,
    downloads: a.stats?.downloads,
    store: a.store?.name,
    url: a.file.path,
    icon: a.icon
  }
}

export default {
  name: 'apk',
  aliases: ['app', 'apkdl', 'getapk'],
  desc: 'Download an Android app (APK). Usage: .apk whatsapp',
  async run(z) {
    const args = [...z.args]
    const listOnly = ['-l', '--list'].includes(args[0])
    if (listOnly) args.shift()
    const query = args.join(' ').trim()
    if (!query) return z.reply(`📦 *APK downloader*\n\n• \`${z.prefix}apk whatsapp\` — download the best match\n• \`${z.prefix}apk -l tiktok\` — list the top results`)

    await z.react('🔎').catch(() => {})
    try {
      const results = (await search(query, listOnly ? 6 : 5)).map(info)
      if (!results.length) {
        await z.react('❌').catch(() => {})
        return z.reply(`❌ No app found for *${query}*.`)
      }

      if (listOnly) {
        const lines = results.map((a, i) => `${i + 1}. *${a.name}*\n   📦 ${a.pkg}\n   🏷️ v${a.version} • ${a.size ? fmtSize(a.size) : 'size unknown'}`)
        await z.react('✅').catch(() => {})
        return z.reply(`📦 *Results for "${query}"*\n\n${lines.join('\n\n')}\n\nDownload with \`${z.prefix}apk <exact name>\``)
      }

      // Pick the first result small enough to send
      const app = results.find((a) => !a.size || a.size <= MAX_BYTES)
      if (!app) {
        await z.react('❌').catch(() => {})
        return z.reply(`❌ "${results[0].name}" is ${fmtSize(results[0].size)} — over the ${fmtSize(MAX_BYTES)} WhatsApp limit.`)
      }

      await z.reply(`⏳ *Downloading…*\n📱 ${app.name}\n🏷️ v${app.version}${app.size ? ` • ${fmtSize(app.size)}` : ''}`)

      const fileName = `${app.name.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || app.pkg}.apk`
      // { url } lets Baileys stream the file instead of holding it all in RAM
      await z.sock.sendMessage(
        z.jid,
        {
          document: { url: app.url },
          mimetype: 'application/vnd.android.package-archive',
          fileName,
          caption: `📱 *${app.name}*\n📦 ${app.pkg}\n🏷️ v${app.version}${app.size ? `\n💾 ${fmtSize(app.size)}` : ''}${app.store ? `\n🏪 ${app.store}` : ''}`
        },
        { quoted: z.msg }
      )
      await z.react('✅').catch(() => {})
    } catch (e) {
      console.error('[apk]', e)
      await z.reply(`❌ *APK download failed*\n${String(e.message).slice(0, 300)}`)
      await z.react('❌').catch(() => {})
    }
  }
}
