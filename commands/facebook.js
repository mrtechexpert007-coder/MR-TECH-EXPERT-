import { runSocialCommand } from '../lib/socialDl.js'

export default {
  name: 'fb',
  aliases: ['facebook', 'fbdl', 'fbvideo'],
  desc: 'Download Facebook video. Usage: .fb <link>',
  async run(expert) {
    return runSocialCommand(expert, 'facebook', '📘 *Facebook*\nMatumizi: `.fb <link>`')
  }
}
