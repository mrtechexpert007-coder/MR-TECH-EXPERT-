// ⟦EXPERT⟧ auto-update engine
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expertCfg } from '../config/expert.config.js'
import { expertGet, expertSet } from './expert.store.js'
import { expertLog } from './expert.utils.js'
import { expertHub } from '../core/expert.hub.js'

const repo = () => (process.env.UPDATE_REPO || '').replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').trim()
const branch = () => process.env.UPDATE_BRANCH || 'main'
const token = () => process.env.GITHUB_TOKEN || ''
const repoUrl = () => `https://${token() ? token() + '@' : ''}github.com/${repo()}.git`
const KEEP = new Set(['.git', 'node_modules', 'storage', '.env'])
let busy = false

export const expertUpdateConfigured = () => !!repo()
export const expertUpdateAuto = () => expertGet(expertCfg.owner, 'update:auto', /^(1|true|on)$/i.test(process.env.AUTO_UPDATE || ''))

export function expertVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(expertCfg.root, 'package.json'), 'utf8')).version || '0.0.0' } catch { return '0.0.0' }
}

function readState() { const sha = expertGet(expertCfg.owner, 'update:sha', null); return sha ? { sha } : null }
function writeState(st) { expertSet(expertCfg.owner, 'update:sha', st.sha) }

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { ...opts, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
    let out = ''
    const t = setTimeout(() => { try { p.kill('SIGKILL') } catch {} }, opts.timeout || 120000)
    p.stdout.on('data', (d) => { out += d })
    p.stderr.on('data', (d) => { out += d })
    p.on('error', (e) => { clearTimeout(t); resolve({ code: -1, out: e.message }) })
    p.on('close', (code) => { clearTimeout(t); resolve({ code, out: out.split(token() || '\u0000').join('***') }) })
  })
}

async function remoteSha() {
  try {
    const r = await fetch(`https://api.github.com/repos/${repo()}/commits/${branch()}`, {
      headers: { Accept: 'application/vnd.github.sha', 'User-Agent': 'expert-mini-updater', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      signal: AbortSignal.timeout(20000)
    })
    if (r.ok) { const sha = (await r.text()).trim(); if (/^[0-9a-f]{40}$/i.test(sha)) return sha }
  } catch {}
  const g = await run('git', ['ls-remote', repoUrl(), `refs/heads/${branch()}`], { timeout: 30000 })
  const sha = g.code === 0 ? g.out.trim().split(/\s+/)[0] : ''
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('cannot reach the GitHub repo (check UPDATE_REPO / UPDATE_BRANCH / GITHUB_TOKEN)')
  return sha
}

// Heroku: filesystem is wiped on restart → ask Heroku to build + release the newest GitHub code (public repo)
export const expertOnHeroku = () => !!process.env.DYNO
const herokuReady = () => !!(process.env.HEROKU_API_KEY && process.env.HEROKU_APP_NAME)

async function herokuDeploy(sha) {
  const r = await fetch(`https://api.heroku.com/apps/${encodeURIComponent(process.env.HEROKU_APP_NAME)}/builds`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.heroku+json; version=3',
      Authorization: `Bearer ${process.env.HEROKU_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ source_blob: { url: `https://github.com/${repo()}/tarball/${branch()}`, version: sha } }),
    signal: AbortSignal.timeout(30000)
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Heroku API ${r.status}: ${j.message || j.id || 'request failed'}`)
  return j.id
}

export async function expertCheckUpdate() {
  if (!repo()) throw new Error('UPDATE_REPO is not set (example: UPDATE_REPO=yourname/expert)')
  const sha = await remoteSha()
  const st = readState()
  if (!st?.sha) { writeState({ sha, at: Date.now() }); return { status: 'baseline', sha, current: sha } }
  return { status: st.sha === sha ? 'latest' : 'available', sha, current: st.sha }
}

function listJs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (KEEP.has(e.name)) continue
    const f = path.join(dir, e.name)
    if (e.isDirectory()) listJs(f, out)
    else if (e.name.endsWith('.js')) out.push(f)
  }
  return out
}

export async function expertApplyUpdate() {
  if (busy) throw new Error('an update is already running')
  if (expertOnHeroku()) {
    if (!herokuReady()) throw new Error('on Heroku set HEROKU_API_KEY and HEROKU_APP_NAME (Config Vars) — or enable Automatic Deploys from GitHub')
    busy = true
    try {
      const sha = await remoteSha()
      const build = await herokuDeploy(sha)
      writeState({ sha, at: Date.now() })
      return { sha, heroku: true, build, files: 0, installed: false }
    } finally { busy = false }
  }
  busy = true
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'expert-upd-'))
  try {
    const sha = await remoteSha()
    const c = await run('git', ['clone', '--depth', '1', '-b', branch(), repoUrl(), tmp + '/src'], { timeout: 180000 })
    if (c.code !== 0) throw new Error('git clone failed: ' + c.out.slice(-200))
    const src = path.join(tmp, 'src')

    for (const f of listJs(src)) {
      const k = await run('node', ['--check', f], { timeout: 20000 })
      if (k.code !== 0) throw new Error(`update rejected — syntax error in ${path.relative(src, f)}`)
    }

    const readPkg = (d) => { try { return JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8')) } catch { return {} } }
    const oldDeps = JSON.stringify(readPkg(expertCfg.root).dependencies || {})
    const newDeps = JSON.stringify(readPkg(src).dependencies || {})

    let files = 0
    fs.cpSync(src, expertCfg.root, {
      recursive: true, force: true,
      filter: (s) => {
        const rel = path.relative(src, s)
        if (!rel) return true
        if (KEEP.has(rel.split(path.sep)[0])) return false
        if (fs.statSync(s).isFile()) files++
        return true
      }
    })

    let installed = false
    if (oldDeps !== newDeps) {
      const i = await run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: expertCfg.root, timeout: 600000 })
      if (i.code !== 0) expertLog.warn('npm install failed: ' + i.out.slice(-200))
      installed = i.code === 0
    }
    writeState({ sha, at: Date.now() })
    return { sha, files, installed }
  } finally {
    busy = false
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

export function expertRestartSoon(ms = 2000) { setTimeout(() => process.exit(1), ms) }

export function expertStartAutoUpdate() {
  if (!repo()) return
  const every = Math.max(5, Number(process.env.UPDATE_INTERVAL_MIN) || 30) * 60_000
  const tick = async () => {
    if (!expertUpdateAuto()) return
    try {
      const r = await expertCheckUpdate()
      if (r.status !== 'available') return
      expertLog.info(`auto-update: new commit ${r.sha.slice(0, 7)} found — applying`)
      const u = await expertApplyUpdate()
      if (u.heroku) return expertLog.ok(`auto-update: Heroku build ${u.build} started — dyno restarts when the release is live`)
      expertLog.ok(`auto-update applied (${u.files} files${u.installed ? ', deps installed' : ''}) — restarting`)
      expertRestartSoon(1500)
    } catch (e) { expertLog.warn(`auto-update: ${e.message}`) }
  }
  setTimeout(tick, 60_000).unref?.()
  setInterval(tick, every).unref?.()
  expertLog.info(`auto-update watcher ready (${repo()}@${branch()}, every ${every / 60000} min, ${expertUpdateAuto() ? 'ON' : 'OFF'})`)
}

export async function expertUpdateNotice(session, sock) {
  const num = session.number
  const ver = expertVersion()
  const seen = expertGet(num, 'update:seen', undefined)
  if (seen === undefined) { expertSet(num, 'update:seen', ver); return }
  if (seen === ver) return
  expertSet(num, 'update:seen', ver)
  if (!expertGet(num, 'update:notice', true)) return
  let notes = ''
  try { notes = fs.readFileSync(path.join(expertCfg.root, 'UPDATE.md'), 'utf8').trim().slice(0, 900) } catch {}
  const p = expertCfg.prefixes[0]
  const text = [
    `🔄 *${expertCfg.botName} imesasishwa* → v${ver}`,
    notes ? `\n${notes}` : '',
    `\n✅ Hakuna unachohitaji kufanya — update imekuja yenyewe.`,
    `_Kuzima ujumbe huu: ${p}update notice off_`
  ].join('\n')
  try { await sock.sendMessage(`${num}@s.whatsapp.net`, { text }) } catch (e) { expertLog.warn(`update notice ${num}: ${e.message}`) }
}

export const expertActiveSessions = () => [...expertHub.sessions.values()].filter((s) => s.opened).length
