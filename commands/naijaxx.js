import naija from './naija.js'
export default {
  name: 'naijaxx',
  aliases: 'nj,xx'.split(','),
  desc: 'naijaxx search',
  async run(expert) {
    const q = expert.text.trim()
    expert.args = q ? ['site', 'naijaxx', ...q.split(/\s+/)] : ['site', 'naijaxx', 'latest']
    expert.text = expert.args.join(' ')
    return naija.run(expert)
  }
}
