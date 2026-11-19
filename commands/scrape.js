// ⟦EXPERT⟧ .scrape — Super Deep Web Recon (endpoints, tokens, subdomains, DNS, secrets)
// Adapted from Hirara AI / Mommy Kyu scrape.js → NEXUS-MD structure

import axios from 'axios'
import * as cheerio from 'cheerio'
import dns from 'node:dns'
import { URL } from 'node:url'

const dnsLookup = (hostname) =>
  new Promise((resolve) => {
    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err || !addresses) return resolve([])
      resolve(addresses.map((a) => a.address))
    })
  })

const dnsResolveMx = (hostname) =>
  new Promise((resolve) => {
    dns.resolveMx(hostname, (err, addresses) => {
      if (err || !addresses) return resolve([])
      resolve(addresses.map((a) => `${a.exchange} (prio:${a.priority})`))
    })
  })

const dnsResolveNs = (hostname) =>
  new Promise((resolve) => {
    dns.resolveNs(hostname, (err, addresses) => {
      if (err || !addresses) return resolve([])
      resolve(addresses)
    })
  })

const SECRET_PATTERNS = [
  { name: 'OpenAI API Key', regex: /sk-(?:proj-|live-|admin-|none-)?[a-zA-Z0-9_-]{20,120}/g },
  { name: 'Anthropic Claude Key', regex: /sk-ant-(?:api\d{2}-)?[a-zA-Z0-9_-]{80,130}/g },
  { name: 'Google Gemini / AI Studio / Firebase Key', regex: /AIza[0-9A-Za-z-_]{35}/g },
  { name: 'Groq API Key', regex: /gsk_[a-zA-Z0-9]{48,64}/g },
  { name: 'HuggingFace Token', regex: /hf_[a-zA-Z0-9]{34,50}/g },
  { name: 'Cohere API Key', regex: /co-[a-zA-Z0-9]{40}/g },
  { name: 'Perplexity API Key', regex: /pplx-[a-zA-Z0-9]{48}/g },
  { name: 'DeepSeek API Key', regex: /sk-[a-zA-Z0-9]{32}/g },
  { name: 'Replicate API Token', regex: /r8_[a-zA-Z0-9]{36,40}/g },
  { name: 'AWS Access Key ID', regex: /(?:AKIA|ASIA|AROA|A3T)[0-9A-Z]{16}/g },
  {
    name: 'AWS Secret Access Key',
    regex: /(?:aws_secret_access_key|aws_secret_key|secret_key|aws_secret)\s*[:=]\s*['"]([A-Za-z0-9/+=]{40})['"]/gi,
    group: 1
  },
  {
    name: 'Amazon S3 Bucket / ARN',
    regex:
      /(?:https?:\/\/[a-zA-Z0-9.\-_]+\.s3(?:\.[a-zA-Z0-9.\-_]+)?\.amazonaws\.com|s3:\/\/[a-zA-Z0-9.\-_]+|arn:aws:s3:::[a-zA-Z0-9.\-_]+)/gi
  },
  { name: 'Google OAuth Client ID', regex: /[0-9]+-[a-z0-9_]{10,}\.apps\.googleusercontent\.com/gi },
  {
    name: 'Google OAuth Client Secret',
    regex: /(?:client_secret|g_secret)\s*[:=]\s*['"]([a-zA-Z0-9_-]{24,35})['"]/gi,
    group: 1
  },
  { name: 'Firebase Database URL', regex: /https:\/\/[a-zA-Z0-9_-]+\.firebaseio\.com/gi },
  {
    name: 'Firebase Storage URL',
    regex: /https?:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[a-zA-Z0-9_.-]+/gi
  },
  { name: 'DigitalOcean Personal Token', regex: /dop_v1_[a-f0-9]{64}/gi },
  { name: 'Cloudflare API Token', regex: /cfat_[a-zA-Z0-9_-]{40,}/gi },
  { name: 'Vercel Token', regex: /vercel_[a-zA-Z0-9_-]{24,}/gi },
  { name: 'Netlify Access Token', regex: /nfp_[a-zA-Z0-9]{40,60}/gi },
  { name: 'Pterodactyl Client / App API Key', regex: /ptl[ac]_[a-zA-Z0-9_-]{40,}/gi },
  { name: 'Supabase Project URL', regex: /https:\/\/[a-z0-9-]+\.supabase\.co/gi },
  {
    name: 'Supabase Anon / Service Role Key',
    regex:
      /(?:anon[_-]?key|service[_-]?role[_-]?key|supabase[_-]?(?:key|anon|service))\s*[:=]\s*['"](eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})['"]/gi,
    group: 1
  },
  {
    name: 'Supabase / PostgREST JWT',
    regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g
  },
  {
    name: 'GitHub Personal Access Token',
    regex: /(?:gh[pousr]_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{22,})/g
  },
  { name: 'GitLab Personal Access Token', regex: /glpat-[a-zA-Z0-9_-]{20,}/g },
  { name: 'NPM Access Token', regex: /npm_[a-zA-Z0-9]{36}/g },
  { name: 'Telegram Bot Token', regex: /[0-9]{8,11}:[a-zA-Z0-9_-]{35}/g },
  {
    name: 'Discord Webhook URL',
    regex: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/gi
  },
  {
    name: 'Discord Bot Token',
    regex: /(?:[A-Za-z\d]{24,26}\.[\w-]{6}\.[\w-]{27,38}|mfa\.[\w-]{84})/g
  },
  {
    name: 'Slack Bot / User Token',
    regex: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/gi
  },
  { name: 'WhatsApp Cloud API / Graph Token', regex: /EAAG[a-zA-Z0-9_-]{50,}/g },
  { name: 'Stripe Secret / Public / Restricted Key', regex: /(?:sk|pk|rk)_(?:live|test)_[0-9a-zA-Z]{24,}/g },
  {
    name: 'Midtrans Server / Client Key',
    regex: /(?:SB-Mid-server-|Mid-server-|SB-Mid-client-|Mid-client-)[a-zA-Z0-9_-]{20,}/gi
  },
  {
    name: 'Xendit Secret / Public Key',
    regex: /xnd_(?:development|production|public)_[a-zA-Z0-9_-]{20,}/gi
  },
  { name: 'SendGrid API Key', regex: /SG\.[0-9a-zA-Z_-]{22}\.[0-9a-zA-Z_-]{43}/g },
  { name: 'Mailgun API Key', regex: /key-[0-9a-zA-Z]{32}/gi },
  { name: 'Twilio Account SID', regex: /AC[a-f0-9]{32}/gi },
  {
    name: 'Twilio Auth Token',
    regex: /(?:twilio[_-]?auth[_-]?token|twilio[_-]?secret)\s*[:=]\s*['"]([a-f0-9]{32})['"]/gi,
    group: 1
  },
  { name: 'Resend API Key', regex: /re_[a-zA-Z0-9]{24,40}/g },
  {
    name: 'Database URI',
    regex:
      /(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|mariadb|sqlite|mssql):\/\/[^\s'"<>`]+/gi
  },
  {
    name: 'RSA / EC Private Key',
    regex:
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g
  },
  { name: 'JSON Web Token (JWT)', regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'Sentry DSN URL', regex: /https:\/\/[a-f0-9]{32}@(?:o\d+\.)?ingest(?:\.us)?\.sentry\.io\/\d+/gi },
  {
    name: 'Bearer Token',
    regex: /Bearer\s+([a-zA-Z0-9_.-]{25,})/gi,
    group: 1
  },
  {
    name: 'Generic API Key / Secret Assignment',
    regex:
      /(?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token|secret[_-]?key|client[_-]?secret|private[_-]?key|app[_-]?secret|bearer[_-]?token|session[_-]?secret|anon[_-]?key|service[_-]?key)\s*[:=]\s*['"]([a-zA-Z0-9_\-\.\:\@\$\#\%\&\*\+\/\=]{8,200})['"]/gi,
    group: 1
  }
]

const ENDPOINT_PATTERNS = [
  /(?:fetch|axios(?:\.get|\.post|\.put|\.delete|\.patch)?|\$\.ajax|\$\.get|\$\.post)\s*\(\s*['"`]([^'"`\s\)\>]+)['"`]/gi,
  /(?:https?:\/\/[a-zA-Z0-9.-]+)?(?:\/api|\/v\d+|\/graphql|\/rest|\/oauth|\/auth|\/webhook|\/admin|\/user|\/users|\/login|\/register|\/config|\/settings|\/data|\/ws|\/socket\.io|\/panel|\/server|\/gateway|\/ajax|\/routes|\/download|\/upload|\/cron)[a-zA-Z0-9_\-\/\.\?\=\&\#\%]*/gi
]

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const IP_PATTERN =
  /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g

function extractMatches(text, regex, groupIndex = 0) {
  const matches = new Set()
  const r = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g')
  let match
  while ((match = r.exec(text)) !== null) {
    const val = groupIndex > 0 ? match[groupIndex] : match[0]
    if (val && typeof val === 'string' && val.trim().length > 0) {
      const clean = val.trim()
      if (
        !clean.includes('example.com') &&
        !clean.includes('username:password') &&
        clean.length <= 400
      ) {
        matches.add(clean)
      }
    }
  }
  return Array.from(matches)
}

async function fetchSubdomains(rootDomain) {
  const subdomains = new Set()
  try {
    const crtRes = await axios
      .get(`https://crt.sh/?q=%25.${rootDomain}&output=json`, { timeout: 8000 })
      .catch(() => null)
    if (crtRes && Array.isArray(crtRes.data)) {
      crtRes.data.forEach((item) => {
        if (item?.name_value) {
          item.name_value.split('\n').forEach((n) => {
            const clean = n.trim().toLowerCase().replace(/^\*\./, '')
            if (clean.endsWith(rootDomain) && clean.length <= 80 && !clean.includes(' ')) {
              subdomains.add(clean)
            }
          })
        }
      })
    }
  } catch {}

  try {
    const htRes = await axios
      .get(`https://api.hackertarget.com/hostsearch/?q=${rootDomain}`, { timeout: 8000 })
      .catch(() => null)
    if (htRes && typeof htRes.data === 'string' && !htRes.data.includes('error')) {
      htRes.data.split('\n').forEach((l) => {
        const [host] = l.split(',')
        if (host && host.includes(rootDomain)) subdomains.add(host.trim().toLowerCase())
      })
    }
  } catch {}

  return Array.from(subdomains)
}

async function getIpInfo(ip) {
  try {
    const res = await axios
      .get(
        `http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,isp,org,as,query`,
        { timeout: 4000 }
      )
      .catch(() => null)
    if (res?.data?.status === 'success') return res.data
  } catch {}
  return null
}

function getText(expert) {
  return (
    expert.args?.join?.(' ') ||
    expert.text ||
    expert.body ||
    expert.msg?.message?.conversation ||
    expert.msg?.message?.extendedTextMessage?.text ||
    ''
  )
    .replace(/^\.[a-z]+\s*/i, '')
    .trim()
}

export default {
  name: 'scrape',
  aliases: ['recon', 'deepscan', 'webscan'],
  desc: 'Deep web recon: endpoints, tokens, subdomains, DNS, secrets',
  async run(expert) {
    const raw = getText(expert)
    const quoted =
      expert.msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
      expert.msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage
        ?.text ||
      ''

    let target = raw || quoted

    if (!target) {
      return expert.reply(
        `🔍 *SUPER DEEP WEB RECON*\n\n` +
          `Usage: \`.scrape <url / domain / text>\`\n` +
          `Example: \`.scrape https://api.example.com\`\n` +
          `Or: \`.scrape google.com\`\n\n` +
          `Extracts:\n` +
          `• IP, DNS, ISP\n` +
          `• Subdomains\n` +
          `• API keys & secrets (public exposure check)\n` +
          `• Endpoints / paths\n` +
          `• JS chunks\n\n` +
          `_𝙿𝚁𝙸𝙽𝙲𝙴 𝙼𝙸𝙽𝙸_`
      )
    }

    await expert.react('🔍').catch(() => {})

    try {
      let targetUrl = ''
      let rawInputText = ''
      let hostname = ''
      const urlMatch = target.match(/https?:\/\/[^\s]+/i)

      if (urlMatch) {
        targetUrl = urlMatch[0].replace(/[>\])}"']+$/, '')
        try {
          hostname = new URL(targetUrl).hostname
        } catch {}
      } else if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/.*)?$/i.test(target.trim())) {
        targetUrl = `https://${target.trim()}`
        try {
          hostname = new URL(targetUrl).hostname
        } catch {}
      } else {
        rawInputText = target
      }

      let allText = ''
      let scriptList = []
      let hostIps = []
      let mxRecords = []
      let nsRecords = []
      let subdomainsList = []
      let ipGeoInfo = null

      if (targetUrl) {
        hostname = new URL(targetUrl).hostname
        await expert
          .reply(
            `⏳ *Deep recon started…*\nTarget: \`${targetUrl}\`\nHost: \`${hostname}\``
          )
          .catch(() => {})

        const domainParts = hostname.split('.')
        const rootDomain =
          domainParts.length >= 2 ? domainParts.slice(-2).join('.') : hostname

        const [ips, mx, ns, subs] = await Promise.all([
          dnsLookup(hostname),
          dnsResolveMx(hostname),
          dnsResolveNs(hostname),
          fetchSubdomains(rootDomain)
        ])
        hostIps = ips
        mxRecords = mx
        nsRecords = ns
        subdomainsList = subs
        if (hostIps.length) ipGeoInfo = await getIpInfo(hostIps[0])

        const axiosInstance = axios.create({
          timeout: 25000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
          },
          maxRedirects: 5,
          validateStatus: (s) => s < 500
        })

        const response = await axiosInstance.get(targetUrl)
        const html =
          typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data)
        const $ = cheerio.load(html)

        const scriptUrls = new Set()
        $('script[src]').each((_, el) => {
          const src = $(el).attr('src')
          if (src) {
            try {
              scriptUrls.add(new URL(src, targetUrl).href)
            } catch {}
          }
        })
        $('link[rel="modulepreload"], link[rel="preload"][as="script"]').each((_, el) => {
          const href = $(el).attr('href')
          if (href) {
            try {
              scriptUrls.add(new URL(href, targetUrl).href)
            } catch {}
          }
        })

        const inlineChunks =
          html.match(
            /(?:static\/chunks\/[a-zA-Z0-9_-]+\.js|_nuxt\/[a-zA-Z0-9_-]+\.js|assets\/[a-zA-Z0-9_-]+\.js)/gi
          ) || []
        inlineChunks.forEach((chunk) => {
          try {
            scriptUrls.add(new URL(chunk, targetUrl).href)
          } catch {}
        })

        scriptList = Array.from(scriptUrls).slice(0, 30)

        const scriptContents = await Promise.all(
          scriptList.map(async (u) => {
            try {
              const res = await axiosInstance.get(u, { responseType: 'text' })
              return typeof res.data === 'string' ? res.data : ''
            } catch {
              return ''
            }
          })
        )

        allText = [html, ...scriptContents].join('\n')

        const inlineSubRegex = new RegExp(
          `https?:\\/\\/([a-zA-Z0-9.-]+\\.${rootDomain.replace('.', '\\.')})`,
          'gi'
        )
        extractMatches(allText, inlineSubRegex, 1).forEach((s) => {
          if (s && !subdomainsList.includes(s.toLowerCase())) {
            subdomainsList.push(s.toLowerCase())
          }
        })
      } else {
        allText = rawInputText
        await expert.reply('⏳ *Scanning snippet / text…*').catch(() => {})
      }

      const foundTokens = {}
      for (const pat of SECRET_PATTERNS) {
        const matches = extractMatches(allText, pat.regex, pat.group || 0)
        if (matches.length) foundTokens[pat.name] = matches
      }

      const pathMatches = new Set()
      for (const pRegex of ENDPOINT_PATTERNS) {
        const matches = extractMatches(allText, pRegex, 1)
        const matchesFull = extractMatches(allText, pRegex, 0)
        ;[...matches, ...matchesFull].forEach((p) => {
          if (p && typeof p === 'string' && p.length > 1 && !p.startsWith('//')) {
            let cleaned = p.trim()
            if (cleaned.startsWith('http')) {
              try {
                cleaned = new URL(cleaned).pathname
              } catch {}
            }
            if (
              cleaned.startsWith('/') &&
              cleaned.length > 2 &&
              !cleaned.includes(' ') &&
              !cleaned.includes('<')
            ) {
              pathMatches.add(cleaned)
            }
          }
        })
      }
      const cleanedPaths = Array.from(pathMatches).slice(0, 150)

      const emails = extractMatches(allText, EMAIL_PATTERN).slice(0, 20)
      const inlineIps = extractMatches(allText, IP_PATTERN)
        .filter((ip) => !ip.startsWith('127.') && !ip.startsWith('0.') && !ip.startsWith('255.'))
        .slice(0, 20)

      let totalTokensCount = 0
      for (const items of Object.values(foundTokens)) totalTokensCount += items.length

      let report = `🔍 *DEEP RECON RESULT*\n`
      report += `🌐 *Target:* ${targetUrl || 'Raw snippet'}\n`
      if (hostname) report += `🏷️ *Host:* \`${hostname}\`\n`
      if (hostIps.length) report += `🖥️ *IP:* \`${hostIps.join(', ')}\`\n`
      if (ipGeoInfo) {
        report += `📍 *Location/ISP:* ${ipGeoInfo.city || ''}, ${ipGeoInfo.country || ''} (${ipGeoInfo.isp || ipGeoInfo.org || 'Unknown'})\n`
      }
      if (subdomainsList.length) report += `🌍 *Subdomains:* ${subdomainsList.length}\n`
      if (targetUrl) report += `📦 *Scripts crawled:* ${scriptList.length + 1}\n`
      report += `🔑 *Secrets:* ${totalTokensCount}\n`
      report += `🛣️ *Endpoints:* ${cleanedPaths.length}\n`
      report += `────────────────────\n\n`

      if (subdomainsList.length) {
        report += `🌍 *SUBDOMAINS (top ${Math.min(15, subdomainsList.length)}):*\n`
        subdomainsList.slice(0, 15).forEach((sub, i) => {
          report += `  ${i + 1}. \`${sub}\`\n`
        })
        if (subdomainsList.length > 15) {
          report += `  …and ${subdomainsList.length - 15} more\n`
        }
        report += `\n────────────────────\n\n`
      }

      if (hostIps.length || mxRecords.length || nsRecords.length) {
        report += `📡 *DNS:*\n`
        if (hostIps.length) report += ` ├ IP: ${hostIps.join(', ')}\n`
        if (nsRecords.length) report += ` ├ NS: ${nsRecords.slice(0, 4).join(', ')}\n`
        if (mxRecords.length) report += ` └ MX: ${mxRecords.slice(0, 3).join(', ')}\n`
        report += `\n────────────────────\n\n`
      }

      if (totalTokensCount > 0) {
        report += `🔐 *SECRETS FOUND:*\n`
        for (const [name, items] of Object.entries(foundTokens)) {
          report += `\n📌 *${name}* (${items.length}):\n`
          items.slice(0, 8).forEach((t, i) => {
            report += `  [${i + 1}] \`${t}\`\n`
          })
          if (items.length > 8) report += `  …and ${items.length - 8} more\n`
        }
        report += `\n────────────────────\n\n`
      } else {
        report += `🔐 *SECRETS:* none exposed in public HTML/JS\n\n`
      }

      if (cleanedPaths.length) {
        report += `🛣️ *ENDPOINTS (top ${Math.min(20, cleanedPaths.length)}):*\n`
        cleanedPaths.slice(0, 20).forEach((p, i) => {
          report += `  ${i + 1}. \`${p}\`\n`
        })
        if (cleanedPaths.length > 20) {
          report += `  …and ${cleanedPaths.length - 20} more\n`
        }
        report += `\n────────────────────\n\n`
      }

      if (emails.length || inlineIps.length) {
        report += `📧 *CONTACTS / IPs:*\n`
        if (emails.length) report += ` ├ Emails: ${emails.join(', ')}\n`
        if (inlineIps.length) report += ` └ IPs: ${inlineIps.slice(0, 10).join(', ')}\n`
        report += `\n────────────────────\n\n`
      }

      if (scriptList.length) {
        report += `📦 *SCRIPTS (top 5):*\n`
        scriptList.slice(0, 5).forEach((s, i) => {
          report += `  ${i + 1}. ${s}\n`
        })
        if (scriptList.length > 5) report += `  …and ${scriptList.length - 5} more\n`
      }

      report += `\n_𝙿𝚁𝙸𝙽𝙲𝙴 𝙼𝙸𝙽𝙸 • Deep Recon_`

      if (
        report.length <= 3800 &&
        totalTokensCount <= 15 &&
        cleanedPaths.length <= 30 &&
        subdomainsList.length <= 20
      ) {
        await expert.reply(report)
      } else {
        let full = `====================================================\n`
        full += `  𝙿𝚁𝙸𝙽𝙲𝙴 𝙼𝙸𝙽𝙸 DEEP RECON REPORT\n`
        full += `  Target : ${targetUrl || 'Raw snippet'}\n`
        if (hostname) full += `  Host   : ${hostname}\n`
        if (hostIps.length) full += `  IPs    : ${hostIps.join(', ')}\n`
        if (ipGeoInfo) {
          full += `  ISP    : ${ipGeoInfo.isp} (${ipGeoInfo.org || ''})\n`
          full += `  Loc    : ${ipGeoInfo.city}, ${ipGeoInfo.regionName}, ${ipGeoInfo.country}\n`
        }
        full += `  Time   : ${new Date().toISOString()}\n`
        full += `  Subs   : ${subdomainsList.length}\n`
        full += `  Secrets: ${totalTokensCount}\n`
        full += `  Paths  : ${cleanedPaths.length}\n`
        full += `====================================================\n\n`

        if (subdomainsList.length) {
          full += `[+] SUBDOMAINS (${subdomainsList.length})\n`
          full += `----------------------------------------------------\n`
          subdomainsList.forEach((s) => {
            full += ` - ${s}\n`
          })
          full += `\n`
        }

        full += `[+] SECRETS (${totalTokensCount})\n`
        full += `----------------------------------------------------\n`
        for (const [name, items] of Object.entries(foundTokens)) {
          full += `\n[${name}] (${items.length})\n`
          items.forEach((t) => {
            full += ` - ${t}\n`
          })
        }

        full += `\n[+] ENDPOINTS (${cleanedPaths.length})\n`
        full += `----------------------------------------------------\n`
        cleanedPaths.forEach((p) => {
          full += ` - ${p}\n`
        })

        if (emails.length || inlineIps.length) {
          full += `\n[+] EMAILS / IPS\n`
          full += `----------------------------------------------------\n`
          emails.forEach((e) => {
            full += ` - Email: ${e}\n`
          })
          inlineIps.forEach((ip) => {
            full += ` - IP: ${ip}\n`
          })
        }

        full += `\n[+] SCRIPTS (${scriptList.length})\n`
        full += `----------------------------------------------------\n`
        scriptList.forEach((s) => {
          full += ` - ${s}\n`
        })

        const hostClean = hostname
          ? hostname.replace(/[^a-zA-Z0-9.-]/g, '_')
          : 'recon'
        await expert.sock.sendMessage(
          expert.jid,
          {
            document: Buffer.from(full, 'utf8'),
            mimetype: 'text/plain',
            fileName: `recon_${hostClean}_${Date.now()}.txt`,
            caption: `📊 *Full recon:* \`${hostname || targetUrl || 'target'}\`\n${subdomainsList.length} subs · ${totalTokensCount} secrets · ${cleanedPaths.length} endpoints`
          },
          { quoted: expert.msg }
        )
      }

      await expert.react('✅').catch(() => {})
    } catch (err) {
      console.error('[scrape]', err)
      await expert.reply(`❌ *Scrape failed*\n${err.message || err}`)
      await expert.react('❌').catch(() => {})
    }
  }
}
