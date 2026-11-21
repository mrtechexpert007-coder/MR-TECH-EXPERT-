import naija from './naija.js'
export default {
  name: 'darknaija',
  aliases: 'dn,darkn'.split(','),
  desc: 'darknaija search',
  async run(expert) {
    const q = expert.text.trim()
    expert.args = q ? ['site', 'darknaija', ...q.split(/\s+/)] : ['site', 'darknaija', 'latest']
    expert.text = expert.args.join(' ')
    return naija.run(expert)
  }
}
