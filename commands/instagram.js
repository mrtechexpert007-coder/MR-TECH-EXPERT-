import { runSocialCommand } from '../lib/socialDl.js'

export default {
  name: 'ig',
  aliases: ['instagram', 'igdl', 'reel'],
  desc: 'Download Instagram reel/post. Usage: .ig <link>',
  async run(expert) {
    return runSocialCommand(expert, 'instagram', '📸 *Instagram*\nMatumizi: `.ig <link>`')
  }
}
