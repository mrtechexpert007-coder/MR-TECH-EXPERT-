// ⟦EXPERT⟧ siteclone — hifadhi ukurasa wa wavuti (HTML + CSS/JS/picha/fonts) kama ZIP ya kuangalia offline
// Haitumii maktaba za nje: ZIP imeandikwa hapa hapa. Ina ulinzi dhidi ya kufikia anwani za ndani (SSRF).
import dns from 'node:dns/promises'
import net from 'node:net'
import zlib from 'node:zlib'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const TYPE_EXT = {
  'text/css': '.css', 'text/javascript': '.js', 'application/javascript': '.js', 'application/x-javascript': '.js',
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/avif': '.avif',
  'image/svg+xml': '.svg', 'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico',
  'font/woff2': '.woff2', 'font/woff': '.woff', 'font/ttf': '.ttf', 'font/otf': '.otf',
  'application/font-woff2': '.woff2', 'application/font-woff': '.woff'
}

/* ───────────── Usalama: kataa anwani za ndani ───────────── */
export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase()
    if (l === '::' || l === '::1') return true
    if (l.startsWith('::ffff:')) { const v4 = l.slice(7); return net.isIPv4(v4) ? isPrivateAddress(v4) : true }
    return /^f[cd]/.test(l) || /^fe[89ab]/.test(l) || l.startsWith('ff')
  }
  return true
}

async function assertPublicHost(url, allowPrivate) {
  const u = new URL(url)
  if (!/^https?:$/.test(u.protocol)) throw new Error('Link lazima ianze na http:// au https://')
  if (allowPrivate) return
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('Anwani hiyo haruhusiwi')
    return
  }
  if (host === 'localhost' || /\.(localhost|local|internal|lan)$/.test(host)) throw new Error('Anwani hiyo haruhusiwi')
  const addrs = await dns.lookup(host, { all: true })
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error('Anwani hiyo haruhusiwi')
}

async function safeFetch(url, { timeoutMs, maxBytes, allowPrivate }) {
  let cur = url
  for (let i = 0; i <= 5; i++) {
    await assertPublicHost(cur, allowPrivate)
    const res = await fetch(cur, {
      redirect: 'manual',
      headers: { 'User-Agent': UA, Accept: '*/*', 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(timeoutMs)
    })
    const loc = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && loc) { cur = new URL(loc, cur).href; continue }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (Number(res.headers.get('content-length') || 0) > maxBytes) throw new Error('too large')
    const chunks = []
    let total = 0
    for await (const c of res.body) {
      total += c.length
      if (total > maxBytes) { try { await res.body.cancel() } catch {} throw new Error('too large') }
      chunks.push(c)
    }
    const ct = res.headers.get('content-type') || ''
    return {
      buf: Buffer.concat(chunks),
      url: cur,
      type: ct.split(';')[0].trim().toLowerCase(),
      charset: (ct.match(/charset=([\w-]+)/i) || [])[1] || 'utf-8'
    }
  }
  throw new Error('too many redirects')
}

/* ───────────── ZIP ndogo (bila maktaba) ───────────── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }

export function makeZip(entries) {
  const now = new Date()
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  const parts = []
  const central = []
  let offset = 0
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8')
    const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data)
    const comp = zlib.deflateRawSync(raw)
    const useDeflate = comp.length < raw.length
    const data = useDeflate ? comp : raw
    const method = useDeflate ? 8 : 0
    const crc = crc32(raw)

    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8)
    lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14)
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28)

    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10)
    ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16)
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28)
    ch.writeUInt32LE(offset, 42)

    parts.push(lh, name, data)
    central.push(ch, name)
    offset += lh.length + name.length + data.length
  }
  const cd = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, cd, end])
}

/* ───────────── Zana ndogo za HTML/CSS ───────────── */
async function replaceAsync(str, regex, fn) {
  const matches = [...str.matchAll(regex)]
  const results = await Promise.all(matches.map((m) => fn(...m)))
  let i = 0
  return str.replace(regex, () => results[i++])
}
function getAttr(attrs, name) {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null
}
function setAttr(attrs, name, value) {
  return attrs.replace(new RegExp(`((?:^|\\s)${name}\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'i'), `$1"${value}"`)
}
const stripAttr = (attrs, name) => attrs.replace(new RegExp(`\\s${name}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?`, 'gi'), '')
const skipRef = (u) => !u || /^(data:|blob:|javascript:|mailto:|tel:|#|about:)/i.test(u.trim())
const decode = (buf, charset) => { try { return new TextDecoder(charset).decode(buf) } catch { return buf.toString('utf8') } }

/**
 * Hifadhi ukurasa mmoja. Inarudisha { zip, title, finalUrl, files, failed, skipped, spa }.
 * Haifuatilii kurasa nyingine wala haiendeshi JavaScript — ni nakala ya ukurasa kama seva inavyoutuma.
 */
export async function cloneSite(input, opts = {}) {
  const o = {
    allowPrivate: false, maxAssets: 60, maxAssetBytes: 4 * 1048576, maxTotalBytes: 20 * 1048576,
    maxHtmlBytes: 5 * 1048576, timeoutMs: 15000, concurrency: 6, ...opts
  }
  let start = String(input || '').trim()
  if (!start) throw new Error('Weka link ya tovuti')
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(start) && !/^https?:\/\//i.test(start)) throw new Error('Link lazima ianze na http:// au https://')
  if (!/^https?:\/\//i.test(start)) start = 'https://' + start
  try { new URL(start) } catch { throw new Error('Link si sahihi') }

  const page = await safeFetch(start, { timeoutMs: o.timeoutMs, maxBytes: o.maxHtmlBytes, allowPrivate: o.allowPrivate })
  if (page.type && !/html|xml/.test(page.type)) throw new Error('Link hiyo si ukurasa wa HTML')
  let html = decode(page.buf, page.charset)
  const pageUrl = page.url

  let base = pageUrl
  const bm = html.match(/<base\b[^>]*\shref\s*=\s*["']([^"']+)["']/i)
  if (bm) { try { base = new URL(bm[1], pageUrl).href } catch {} }
  html = html.replace(/<base\b[^>]*>/gi, '')

  const files = new Map() // jina -> Buffer
  const byUrl = new Map() // url -> Promise<jina|null>
  let total = 0, count = 0, failed = 0, skipped = 0
  let active = 0
  const waiting = []
  const acquire = () => (active < o.concurrency ? (active++, Promise.resolve()) : new Promise((r) => waiting.push(r)))
  const release = () => { const n = waiting.shift(); if (n) n(); else active-- }

  const mkName = (abs, type) => {
    let seg = ''
    try { seg = decodeURIComponent(new URL(abs).pathname.split('/').filter(Boolean).pop() || '') } catch {}
    seg = seg.replace(/[^\w.\-]+/g, '_').slice(-40) || 'file'
    if (!/\.[A-Za-z0-9]{1,6}$/.test(seg)) seg += TYPE_EXT[type] || ''
    return `${files.size + 1}-${seg}`
  }

  const resolveRef = (ref, from) => {
    if (skipRef(ref)) return null
    try { const u = new URL(ref.trim(), from); u.hash = ''; return /^https?:$/.test(u.protocol) ? u.href : null } catch { return null }
  }

  const processCss = async (css, from, depth, prefix) => {
    css = await replaceAsync(css, /@import\s+(?:url\(\s*)?(["'])([^"']+)\1\s*\)?/gi, async (m, q, u) => {
      const abs = resolveRef(u, from); if (!abs) return m
      const name = await fetchAsset(abs, depth + 1)
      return name ? `@import "${prefix}${name}"` : m
    })
    return replaceAsync(css, /url\(\s*(["']?)([^"')]+)\1\s*\)/gi, async (m, q, u) => {
      const abs = resolveRef(u, from); if (!abs) return m
      const name = await fetchAsset(abs, depth + 1)
      return name ? `url("${prefix}${name}")` : m
    })
  }

  function fetchAsset(abs, depth = 0) {
    if (byUrl.has(abs)) return byUrl.get(abs)
    if (count >= o.maxAssets) { skipped++; return Promise.resolve(null) }
    count++
    const p = (async () => {
      let r
      await acquire()
      try {
        r = await safeFetch(abs, { timeoutMs: o.timeoutMs, maxBytes: o.maxAssetBytes, allowPrivate: o.allowPrivate })
      } catch { failed++; return null } finally { release() }
      if (total + r.buf.length > o.maxTotalBytes) { skipped++; return null }
      total += r.buf.length
      let data = r.buf
      const name = mkName(abs, r.type)
      files.set(name, data) // weka nafasi ili majina yasigongane
      if ((r.type === 'text/css' || /\.css(\?|$)/i.test(abs)) && depth < 3) {
        const css = await processCss(decode(r.buf, r.charset), r.url, depth, '')
        data = Buffer.from(css, 'utf8')
        files.set(name, data)
      }
      return name
    })()
    byUrl.set(abs, p)
    return p
  }

  const local = async (ref) => {
    const abs = resolveRef(ref, base); if (!abs) return null
    const n = await fetchAsset(abs)
    return n ? `assets/${n}` : null
  }

  // tags za rasilimali
  html = await replaceAsync(html, /<(link|script|img|source|video)\b([^>]*)>/gi, async (m, tag, attrs) => {
    tag = tag.toLowerCase()
    let changed = false
    const swap = async (attr) => {
      const v = getAttr(attrs, attr)
      if (v == null) return
      const l = await local(v)
      if (l) { attrs = setAttr(attrs, attr, l); changed = true }
    }
    const swapSrcset = async (attr) => {
      const v = getAttr(attrs, attr)
      if (v == null || /data:/i.test(v)) return
      const items = await Promise.all(v.split(',').map(async (it) => {
        const mm = it.trim().match(/^(\S+)(\s+.+)?$/)
        if (!mm) return it
        const l = await local(mm[1])
        return l ? l + (mm[2] || '') : it
      }))
      attrs = setAttr(attrs, attr, items.join(', ')); changed = true
    }
    if (tag === 'link') {
      const rel = (getAttr(attrs, 'rel') || '').toLowerCase()
      if (/stylesheet|icon/.test(rel)) await swap('href')
    } else if (tag === 'script') {
      await swap('src')
    } else if (tag === 'img') {
      await swap('src'); await swap('data-src'); await swapSrcset('srcset')
    } else if (tag === 'source') {
      await swapSrcset('srcset')
    } else if (tag === 'video') {
      await swap('poster')
    }
    if (!changed) return m
    attrs = stripAttr(stripAttr(stripAttr(attrs, 'integrity'), 'crossorigin'), 'nonce')
    return `<${tag}${attrs}>`
  })

  // <style> ndani ya ukurasa
  html = await replaceAsync(html, /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, async (m, open, css, close) =>
    open + (await processCss(css, base, 0, 'assets/')) + close)

  // viungo vya <a> vifanye kamili ili vifanye kazi hata ukifungua offline (fomu hazibadilishwi)
  html = html.replace(/(<a\b[^>]*?\shref\s*=\s*)(["'])([^"']*)\2/gi, (m, pre, q, href) => {
    if (skipRef(href)) return m
    try { return `${pre}${q}${new URL(href.trim(), base).href}${q}` } catch { return m }
  })

  const title = ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim()
  const visibleText = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  const spa = visibleText.length < 200 && /<script\b/i.test(html)

  const stamp = `<!-- Saved from ${pageUrl} on ${new Date().toISOString()} -->\n`
  const entries = [{ name: 'index.html', data: Buffer.from(stamp + html, 'utf8') }]
  for (const [name, data] of files) entries.push({ name: `assets/${name}`, data })

  return { zip: makeZip(entries), title, finalUrl: pageUrl, files: files.size, failed, skipped, spa }
}
