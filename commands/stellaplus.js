import naija from './naija.js'
export default {
  name: 'stellaplus',
  aliases: 'stella,sp'.split(','),
  desc: 'stellaplus search',
  async run(expert) {
    const q = expert.text.trim()
    expert.args = q ? ['site', 'stellaplus', ...q.split(/\s+/)] : ['site', 'stellaplus', 'latest']
    expert.text = expert.args.join(' ')
    return naija.run(expert)
  }
}
