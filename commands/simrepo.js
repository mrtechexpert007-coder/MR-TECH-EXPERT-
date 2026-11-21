// ⟦EXPERT⟧ .simrepo — find GitHub projects similar to a named one
// Usage: .simrepo <jina la mradi / repo>   e.g.  .simrepo whatsapp-bot
import { expertHttp } from '../lib/expert.admin.js'

const GITHUB_API = 'https://api.github.com'

function starCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function authHeaders() {
  // Optional: set GITHUB_TOKEN in .env to raise the rate limit from
  // 60 req/hour (unauthenticated) to 5000 req/hour. Works with none set.
  const token = process.env.GITHUB_TOKEN
  return {
    'User-Agent': 'nexus-md',
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

/**
 * If the query looks like "owner/repo", pull that repo's topics + primary
 * language first so the search can be steered by them — gives much more
 * relevant "similar project" results than a bare name search alone.
 */
async function enrichQuery(q) {
  const m = q.match(/^([\w.-]+)\/([\w.-]+)$/)
  if (!m) return { searchTerm: q, baseFullName: null }
  try {
    const res = await expertHttp(`${GITHUB_API}/repos/${m[1]}/${m[2]}`, { headers: authHeaders() })
    const repo = await res.json()
    const topics = Array.isArray(repo.topics) ? repo.topics.slice(0, 3) : []
    const terms = [repo.language, ...topics].filter(Boolean)
    return {
      searchTerm: terms.length ? terms.join(' ') : m[2],
      baseFullName: repo.full_name.toLowerCase()
    }
  } catch {
    return { searchTerm: m[2], baseFullName: `${m[1]}/${m[2]}`.toLowerCase() }
  }
}

export default {
  name: 'simrepo',
  aliases: ['similar', 'simproject', 'ghsimilar'],
  desc: 'Find GitHub projects similar to one you name. Usage: .simrepo <jina/owner-repo>',
  async run(expert) {
    const q = expert.text.trim()
    if (!q) return expert.reply('Usage: `.simrepo <jina la mradi>` au `.simrepo owner/repo`')

    await expert.react('🔎').catch(() => {})
    try {
      const { searchTerm, baseFullName } = await enrichQuery(q)
      const url =
        `${GITHUB_API}/search/repositories?q=${encodeURIComponent(searchTerm)}` +
        `&sort=stars&order=desc&per_page=10`
      const res = await expertHttp(url, { headers: authHeaders() })
      const data = await res.json()
      const items = Array.isArray(data.items) ? data.items : []

      const qLower = q.toLowerCase()
      const filtered = items
        .filter((r) => {
          const full = r.full_name.toLowerCase()
          if (baseFullName && full === baseFullName) return false
          if (full === qLower || r.name.toLowerCase() === qLower) return false
          return true
        })
        .slice(0, 5)

      if (!filtered.length) {
        return expert.reply(`❌ Sikuona miradi inayofanana na "*${q}*". Jaribu jina lingine au \`owner/repo\`.`)
      }

      const lines = filtered.map((r, i) => {
        const desc = r.description ? r.description.slice(0, 90) : 'No description'
        return (
          `${i + 1}. *${r.full_name}*\n` +
          `   ⭐ ${starCount(r.stargazers_count)} · ${r.language || '—'}\n` +
          `   ${desc}\n` +
          `   🔗 ${r.html_url}`
        )
      })

      await expert.reply(`📦 *Miradi inayofanana na "${q}":*\n\n${lines.join('\n\n')}`)
      await expert.react('✅').catch(() => {})
    } catch (e) {
      console.error('[simrepo]', e)
      const msg = /HTTP 403/.test(e.message)
        ? 'GitHub rate limit imefikia kikomo. Jaribu tena baada ya dakika chache, au weka GITHUB_TOKEN kwenye .env.'
        : e.message
      await expert.reply(`❌ *Simrepo failed*\n${msg}`)
      await expert.react('❌').catch(() => {})
    }
  }
}
