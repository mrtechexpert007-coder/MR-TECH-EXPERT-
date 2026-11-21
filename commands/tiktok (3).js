// ⟦EXPERT⟧ .tiktok — logic lives in lib/tiktok.js
import { handleTiktok } from '../lib/tiktok.js'

export default {
  name: 'tiktok',
  aliases: ['tt', 'ttdl', 'tiktokdl'],
  desc: 'Download TikTok video. Usage: .tiktok <link> | .tiktok mp3 <link>',
  async run(expert) {
    return handleTiktok(expert)
  }
}
