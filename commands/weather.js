import { expertHttp } from '../lib/expert.admin.js'

export default {
  name: 'weather',
  aliases: ['wthr'],
  desc: 'Weather for a city. Usage: .weather Abuja',
  async run(z) {
    const city = z.text.trim()
    if (!city) return z.reply('Usage: .weather Abuja')
    try {
      const d = await (await expertHttp(`https://wttr.in/${encodeURIComponent(city)}?format=j1`)).json()
      const c = d.current_condition[0]
      const area = d.nearest_area?.[0]
      await z.reply(
        `🌍 *${area?.areaName?.[0]?.value || city}, ${area?.country?.[0]?.value || ''}*\n\n` +
        `🌡️ ${c.temp_C}°C (feels ${c.FeelsLikeC}°C)\n☁️ ${c.weatherDesc[0].value}\n` +
        `💧 Humidity ${c.humidity}%\n💨 Wind ${c.windspeedKmph} km/h\n👁️ Visibility ${c.visibility} km`
      )
    } catch { await z.reply('❌ Could not find that place.') }
  }
}
