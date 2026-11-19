import naija from './naija.js'
export default {
  name: 'knack',
  aliases: 'knackvideos,kv'.split(','),
  desc: 'knackvideos search',
  async run(expert) {
    const q = expert.text.trim()
    expert.args = q ? ['site', 'knackvideos', ...q.split(/\s+/)] : ['site', 'knackvideos', 'latest']
    expert.text = expert.args.join(' ')
    return naija.run(expert)
  }
}
