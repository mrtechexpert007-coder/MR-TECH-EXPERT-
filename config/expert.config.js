// ⟦EXPERT⟧ NEXUS-MD — central config. Edit this file, not the core.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const expertCfg = {
  botName: 'EXPERT MINI BOT',
  engraved: 'EXPERT',
  footer: 'EXPERT MINI BOT • engraved by EXPERT',
  owner: normalizeOwnerNumber(process.env.OWNER_NUMBER || '255711389698'),
  // Additional trusted owners. Nigerian local-format numbers are normalized to +234 digits.
  owners: [...new Set([
    normalizeOwnerNumber(process.env.OWNER_NUMBER || '255711389698'),
    normalizeOwnerNumber('255711389698')
  ])],
  prefixes: ['.', '!', '#', '/'],
  port: Number(process.env.PORT) || 3000,
  maxSessions: Number(process.env.MAX_SESSIONS) || 50,

  root: ROOT,
  sessionsDir: path.join(ROOT, 'storage', 'sessions'),
  publicDir: path.join(ROOT, 'public'),
  logo: path.join(ROOT, 'media', 'logo.jpg'),
  menuImage: path.join(ROOT, 'media', 'menu.jpg'),
  menuThumb: path.join(ROOT, 'media', 'menu-thumb.jpg'),
  assetsDir: path.join(ROOT, 'assets'),
  // Secret emoji → video. Drop the video in /assets and map it here: { 'emoji': 'file name' }.
  // Works for every linked account, in private AND public mode, with or without a prefix.
  secretVideos: {
    '🍿': 'hailexpert.mp4'
  },
  channelUrl: 'https://whatsapp.com/channel/0029VbA1jdkDp2QAvGIIrL0m',
  // Help / support (menu "Help" button, welcome message, pairing page)
  helpNumber: '255711389698',
  helpUrl: 'https://wa.me/255711389698',
  groupUrl: 'https://chat.whatsapp.com/J3Dqv6gg2gJK4l31ZcPJVG',

  // ── Channels (newsletters) ──────────────────────────────
  // Every linked account auto-follows these on connect and
  // auto-reacts to every new post from them.
  newsletter: {
    autoFollow: true,
    autoReact: true,
    channels: [
      '120363401161498024@newsletter'
    ],
    reactions: ['❤️', '🔥', '👍', '😂', '😲', '🙏', '🥲', '😭'],
    reactDelayMs: [2000, 5000] // random delay range before reacting
  },

  // ── Groups (auto-join) ──────────────────────────────────
  // Every linked account auto-joins these groups on connect, the
  // same way it auto-follows the channels above. Add invite links
  // below — the bot extracts the code itself. A group it has already
  // joined, or a dead/revoked link, is skipped quietly.
  autoJoinGroups: {
    enabled: true,
    links: [
      'https://chat.whatsapp.com/J3Dqv6gg2gJK4l31ZcPJVG'
    ],
    joinDelayMs: [2000, 5000] // random delay range between joins
  }
}

function normalizeOwnerNumber(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`
  if (digits.startsWith('234') && digits.length === 13) return digits
  return digits
}
