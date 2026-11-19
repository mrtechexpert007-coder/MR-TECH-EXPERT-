// ⟦EXPERT⟧ .livescore — ESPN football scores
import axios from 'axios'

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const LEAGUES = {
  all: { path: 'all', name: 'All competitions' },
  pl: { path: 'eng.1', name: 'Premier League' },
  epl: { path: 'eng.1', name: 'Premier League' },
  laliga: { path: 'esp.1', name: 'La Liga' },
  seriea: { path: 'ita.1', name: 'Serie A' },
  bundesliga: { path: 'ger.1', name: 'Bundesliga' },
  ligue1: { path: 'fra.1', name: 'Ligue 1' },
  ucl: { path: 'uefa.champions', name: 'Champions League' },
  uel: { path: 'uefa.europa', name: 'Europa League' },
  mls: { path: 'usa.1', name: 'MLS' },
  npfl: { path: 'nga.1', name: 'NPFL' }
}

function pick(competitors, side) {
  const list = competitors || []
  return list.find((c) => c.homeAway === side) || (side === 'home' ? list[0] : list[1]) || {}
}

function norm(e) {
  const comp = e.competitions?.[0] || {}
  const st = comp.status?.type || {}
  const h = pick(comp.competitors, 'home')
  const a = pick(comp.competitors, 'away')
  const state = st.state || ''
  return {
    league: e.league?.name || e.leagues?.[0]?.name || e.shortName || '',
    home: h.team?.displayName || 'Home',
    away: a.team?.displayName || 'Away',
    homeScore: h.score != null ? String(h.score) : '-',
    awayScore: a.score != null ? String(a.score) : '-',
    clock: st.detail || st.shortDetail || '',
    isLive: state === 'in',
    isDone: state === 'post',
    isPre: state === 'pre'
  }
}

export default {
  name: 'livescore',
  aliases: ['score', 'scores', 'livescores', 'fixture', 'fixtures'],
  desc: 'Football live scores',
  async run(expert) {
    const tokens = (expert.args || []).map((a) => String(a).toLowerCase())
    if (tokens.includes('help') || tokens.includes('?')) {
      return expert.reply(
        '⚽ *Livescore*\n' +
          '`.livescore` — today (all)\n' +
          '`.livescore live` — live only\n' +
          '`.livescore pl|laliga|seriea|bundesliga|ligue1|ucl|uel|mls`'
      )
    }

    let leagueKey = 'all'
    let liveOnly = false
    for (const t of tokens) {
      if (t === 'live' || t === 'now' || t === 'playing') liveOnly = true
      else if (LEAGUES[t]) leagueKey = t
    }
    const league = LEAGUES[leagueKey]

    await expert.react('⚽').catch(() => {})
    try {
      const res = await axios.get(`${ESPN}/${league.path}/scoreboard`, {
        timeout: 30000,
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        validateStatus: () => true
      })

      if (res.status !== 200) {
        throw new Error(`ESPN HTTP ${res.status}`)
      }

      let matches = (res.data?.events || []).map(norm)
      if (liveOnly) matches = matches.filter((m) => m.isLive)

      if (!matches.length) {
        return expert.reply(
          liveOnly
            ? `⚽ No live matches for *${league.name}* right now.`
            : `⚽ No matches found for *${league.name}*.`
        )
      }

      matches.sort((a, b) => {
        const rank = (m) => (m.isLive ? 0 : m.isDone ? 1 : 2)
        return rank(a) - rank(b)
      })

      const lines = matches.slice(0, 25).map((m) => {
        const badge = m.isLive ? '🔴' : m.isDone ? '✅' : '⏳'
        const score =
          m.isPre && m.homeScore === '-' ? 'vs' : `${m.homeScore} - ${m.awayScore}`
        const leagueBit = m.league ? ` · ${m.league}` : ''
        return `${badge} *${m.home}* ${score} *${m.away}*\n   ${m.clock}${leagueBit}`
      })

      const liveCount = matches.filter((m) => m.isLive).length
      const title = liveOnly ? `LIVE · ${league.name}` : `SCORES · ${league.name}`
      const text =
        `⚽ *${title}*\n\n` +
        lines.join('\n') +
        `\n\n📊 ${liveCount} live · ${matches.length} total\n_NEXUS-MD · ESPN_`

      await expert.reply(text)
      await expert.react('✅').catch(() => {})
    } catch (e) {
      console.error('[livescore]', e)
      await expert.reply(`❌ *Livescore failed*\n${e.message || e}`)
      await expert.react('❌').catch(() => {})
    }
  }
}
