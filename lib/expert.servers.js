// EXPERT MINI BOT — launcher
// Downloads the bot from GitHub, installs it, runs it, and restarts it if it crashes.
// Only edit GITHUB_REPO below (or set the GITHUB_REPO config var on the host).
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

// ─── EDIT HERE ────────────────────────────────────────────────────────────────
// GitHub link of your bot: "owner/repo" or the full https://github.com/owner/repo link
const GITHUB_REPO = process.env.GITHUB_REPO || 'https://github.com/majidishaweji602-a11y/expert'
const BRANCH = process.env.GITHUB_BRANCH || 'main'
// Only needed when the repo is private (GitHub → Settings → Developer settings → Tokens)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''
// ──────────────────────────────────────────────────────────────────────────────

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const APP = path.join(ROOT, 'bot')
const TMP = path.join(ROOT, '.bot-download.tgz')
const log = (...a) => console.log('[launcher]', ...a)

function parseRepo(input) {
  const m = String(input).trim().replace(/\.git$/, '').replace(/\/+$/, '').match(/(?:github\.com[/:])?([\w.-]+)\/([\w.-]+)$/)
  if (!m) throw new Error(`invalid GitHub repo: "${input}" (use owner/repo)`)
  return { owner: m[1], repo: m[2] }
}

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('http://') ? http : https
    const headers = { 'User-Agent': 'expert-mini-launcher' }
    if (GITHUB_TOKEN && /github\.com|githubusercontent\.com/.test(new URL(url).host)) headers.Authorization = `Bearer ${GITHUB_TOKEN}`
    lib.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        if (redirects > 5) return reject(new Error('too many redirects'))
        return resolve(download(new URL(res.headers.location, url).toString(), dest, redirects + 1))
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`download failed (HTTP ${res.statusCode}) — check the repo name, branch, and that it is public (or set GITHUB_TOKEN)`))
      }
      const out = fs.createWriteStream(dest)
      res.pipe(out)
      out.on('finish', () => out.close(resolve))
      out.on('error', reject)
    }).on('error', reject).setTimeout(60000, function () { this.destroy(new Error('download timeout')) })
  })
}

async function fetchBot() {
  const url = process.env.BOT_TARBALL_URL || (() => {
    const { owner, repo } = parseRepo(GITHUB_REPO)
    return `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${encodeURIComponent(BRANCH)}`
  })()
  log(`downloading bot (${GITHUB_REPO}@${BRANCH}) …`)
  await download(url, TMP)
  const next = APP + '.new'
  fs.rmSync(next, { recursive: true, force: true })
  fs.mkdirSync(next, { recursive: true })
  const t = spawnSync('tar', ['-xzf', TMP, '--strip-components=1', '-C', next], { encoding: 'utf8' })
  fs.rmSync(TMP, { force: true })
  if (t.status !== 0) throw new Error('extract failed: ' + (t.stderr || '').slice(-200))
  if (!fs.existsSync(path.join(next, 'index.js'))) throw new Error('downloaded repo has no index.js in its root')
  // keep installed modules + local storage from the previous copy
  for (const keep of ['node_modules', 'storage']) {
    const old = path.join(APP, keep)
    if (fs.existsSync(old) && !fs.existsSync(path.join(next, keep))) fs.renameSync(old, path.join(next, keep))
  }
  fs.rmSync(APP, { recursive: true, force: true })
  fs.renameSync(next, APP)
  log('bot downloaded ✔')
}

function install() {
  if (!fs.existsSync(path.join(APP, 'package.json'))) return
  log('installing dependencies …')
  const r = spawnSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: APP, stdio: 'inherit' })
  if (r.status !== 0) throw new Error('npm install failed')
  log('dependencies ready ✔')
}

let child = null
let stopping = false
let fastCrashes = 0

function start() {
  const began = Date.now()
  log('starting bot …')
  child = spawn(process.execPath, ['index.js'], { cwd: APP, stdio: 'inherit', env: process.env })
  child.on('exit', (code, sig) => {
    if (stopping) return process.exit(0)
    fastCrashes = Date.now() - began < 20000 ? fastCrashes + 1 : 0
    const wait = Math.min(60, 3 * 2 ** Math.min(fastCrashes, 5))
    log(`bot stopped (${sig || 'code ' + code}) — restarting in ${wait}s`)
    setTimeout(start, wait * 1000)
  })
}

for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { stopping = true; child ? child.kill(s) : process.exit(0) })
process.on('uncaughtException', (e) => log('error:', e.message))

try {
  await fetchBot()
  install()
} catch (e) {
  log('⚠', e.message)
  if (!fs.existsSync(path.join(APP, 'index.js'))) {
    log('no previous copy of the bot to fall back on — exiting')
    process.exit(1)
  }
  log('using the previous copy of the bot')
}
start()
