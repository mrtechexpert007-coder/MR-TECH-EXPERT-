// ⟦EXPERT⟧ resolve ffmpeg binary: env → ffmpeg-static → system paths
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const SYSTEM = [
  process.env.FFMPEG_PATH,
  'ffmpeg',
  '/usr/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/bin/ffmpeg',
  '/data/data/com.termux/files/usr/bin/ffmpeg'
].filter(Boolean)

let cached = null

function works(bin) {
  try {
    if (bin !== 'ffmpeg' && !fs.existsSync(bin)) return false
    execFileSync(bin, ['-version'], { stdio: 'ignore', timeout: 8000 })
    return true
  } catch {
    return false
  }
}

export function getFfmpegPath() {
  if (cached) return cached

  // 1) npm ffmpeg-static (bundled binary — no apt needed)
  try {
    const staticPath = require('ffmpeg-static')
    if (staticPath && works(staticPath)) {
      cached = staticPath
      return cached
    }
  } catch {
    /* not installed */
  }

  // 2) @ffmpeg-installer/ffmpeg
  try {
    const installer = require('@ffmpeg-installer/ffmpeg')
    if (installer?.path && works(installer.path)) {
      cached = installer.path
      return cached
    }
  } catch {
    /* not installed */
  }

  // 3) system
  for (const bin of SYSTEM) {
    if (works(bin)) {
      cached = bin
      return cached
    }
  }

  return null
}

export function requireFfmpeg() {
  const bin = getFfmpegPath()
  if (!bin) {
    throw new Error(
      'ffmpeg not found.\n' +
        'Install ONE of these:\n' +
        '• npm i ffmpeg-static@5.3.0   (recommended, no root)\n' +
        '• sudo apt install -y ffmpeg\n' +
        '• pkg install ffmpeg   (Termux)\n' +
        '• export FFMPEG_PATH=/path/to/ffmpeg'
    )
  }
  return bin
}
