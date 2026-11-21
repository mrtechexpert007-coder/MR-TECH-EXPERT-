// ⟦EXPERT⟧ download big files straight to disk (not RAM) so they can be sent as a stream
import axios from 'axios'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

export const BIG_MAX = Number(process.env.BIGFILE_MAX_MB || 700) * 1024 * 1024

/** Download a url to a temp file. Returns { file, size, type, cleanup() } */
export async function downloadToDisk(url, { headers = {}, maxBytes = BIG_MAX, ext = '' } = {}) {
  const file = path.join(os.tmpdir(), `expert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`)
  const cleanup = () => fs.promises.unlink(file).catch(() => {})
  try {
    const res = await axios.get(url, { responseType: 'stream', headers, timeout: 0, maxRedirects: 5 })
    const len = Number(res.headers['content-length'] || 0)
    if (len && len > maxBytes) { res.data.destroy(); throw new Error(`File is too large (${(len / 1048576).toFixed(0)} MB, limit ${(maxBytes / 1048576).toFixed(0)} MB)`) }

    let got = 0
    res.data.on('data', (c) => {
      got += c.length
      if (got > maxBytes) res.data.destroy(new Error('File exceeded the size limit'))
    })
    await pipeline(res.data, fs.createWriteStream(file))
    return { file, size: got, type: String(res.headers['content-type'] || ''), cleanup }
  } catch (e) {
    await cleanup()
    throw e
  }
}
