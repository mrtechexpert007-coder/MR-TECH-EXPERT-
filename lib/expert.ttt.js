// ⟦EXPERT⟧ Tic-Tac-Toe engine — one game per chat, in memory. Used by .ttt and by plain "1-9" messages in groups.
import { expertGet, expertSet } from './expert.store.js'
import { expertNumber } from './expert.utils.js'
import { expertBox } from './expert.frame.js'

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
const SYM = { x: '❌', o: '⭕' }
const NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']
const games = new Map() // `${ns}|${jid}` -> game
const PENDING_TTL = 2 * 60 * 1000
const PLAY_TTL = 5 * 60 * 1000

export const tttKey = (ns, jid) => `${ns}|${jid}`
export function tttGet(ns, jid) {
  const k = tttKey(ns, jid)
  const g = games.get(k)
  if (!g) return null
  if (Date.now() - g.last > (g.state === 'pending' ? PENDING_TTL : PLAY_TTL)) { games.delete(k); return null }
  return g
}
export const tttEnd = (ns, jid) => games.delete(tttKey(ns, jid))
export function tttCreate(ns, jid, x, o, state) {
  const g = { x, o, state, board: Array(9).fill(null), turn: 'x', last: Date.now() }
  games.set(tttKey(ns, jid), g)
  return g
}

const winner = (b) => {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]
  return b.every(Boolean) ? 'draw' : null
}
function minimax(b, turn, me, depth) {
  const w = winner(b)
  if (w === 'draw') return 0
  if (w) return w === me ? 10 - depth : depth - 10
  const scores = []
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue
    b[i] = turn
    scores.push(minimax(b, turn === 'x' ? 'o' : 'x', me, depth + 1))
    b[i] = null
  }
  return turn === me ? Math.max(...scores) : Math.min(...scores)
}
function botMove(b) {
  const empty = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0)
  if (Math.random() < 0.25) return empty[Math.floor(Math.random() * empty.length)] // not unbeatable, on purpose
  let best = -Infinity, pick = empty[0]
  for (const i of empty) {
    b[i] = 'o'
    const s = minimax(b, 'x', 'o', 1)
    b[i] = null
    if (s > best || (s === best && Math.random() < 0.4)) { best = s; pick = i }
  }
  return pick
}

const name = (p) => (p === 'bot' ? '🤖 Bot' : `@${expertNumber(p.jid)}`)
const jidsOf = (g) => [g.x, g.o].filter((p) => p && p !== 'bot').map((p) => p.jid)
export function tttBoard(g) {
  const cell = (i) => (g.board[i] ? SYM[g.board[i]] : NUM[i])
  return [0, 3, 6].map((r) => [0, 1, 2].map((c) => cell(r + c)).join(' ┃ ')).join('\n━━━━╋━━━━╋━━━━\n')
}
export const tttHeader = (g) => `${SYM.x} ${name(g.x)}  vs  ${SYM.o} ${name(g.o)}`

function record(ns, jid, p, field) {
  if (!p || p === 'bot') return
  const all = expertGet(ns, `ttt:${jid}`, {})
  const id = expertNumber(p.jid)
  const r = (all[id] ??= { jid: p.jid, w: 0, l: 0, d: 0 })
  r[field]++
  expertSet(ns, `ttt:${jid}`, all)
}

const send = (sock, jid, g, lines, msg) =>
  sock.sendMessage(jid, { text: expertBox('⭕', 'TIC TAC TOE', lines), mentions: jidsOf(g) }, msg ? { quoted: msg } : undefined)

export async function tttShow(sock, jid, g, msg, extra = []) {
  const turn = g[g.turn]
  await send(sock, jid, g, [
    tttHeader(g), '', ...tttBoard(g).split('\n'), '',
    ...extra,
    turn === 'bot' ? '🤖 Bot is thinking…' : `Turn: ${SYM[g.turn]} ${name(turn)} — send a number *1-9*`
  ], msg)
}

async function finish(sock, ns, jid, g, w, msg) {
  games.delete(tttKey(ns, jid))
  if (w === 'draw') {
    record(ns, jid, g.x, 'd'); record(ns, jid, g.o, 'd')
    return send(sock, jid, g, [tttHeader(g), '', ...tttBoard(g).split('\n'), '', '🤝 *It\'s a draw!*'], msg)
  }
  const win = g[w], lose = g[w === 'x' ? 'o' : 'x']
  record(ns, jid, win, 'w'); record(ns, jid, lose, 'l')
  await send(sock, jid, g, [tttHeader(g), '', ...tttBoard(g).split('\n'), '', win === 'bot' ? '🤖 *The bot wins!* Better luck next time.' : `🏆 *${name(win)} wins!* 🎉`], msg)
}

/** play a move. returns 'ok' | 'nogame' | 'notplayer' | 'notturn' | 'taken' */
export async function tttPlay(sock, ns, jid, msg, ids, cell) {
  const g = tttGet(ns, jid)
  if (!g || g.state !== 'playing') return 'nogame'
  const isX = g.x.ids.some((i) => ids.includes(i))
  const isO = g.o !== 'bot' && g.o.ids.some((i) => ids.includes(i))
  if (!isX && !isO) return 'notplayer'
  if (g.turn !== (isX ? 'x' : 'o')) return 'notturn'
  if (g.board[cell]) return 'taken'
  g.board[cell] = g.turn
  g.last = Date.now()
  let w = winner(g.board)
  if (w) { await finish(sock, ns, jid, g, w, msg); return 'ok' }
  g.turn = g.turn === 'x' ? 'o' : 'x'
  if (g.o === 'bot' && g.turn === 'o') {
    await new Promise((r) => setTimeout(r, 700))
    g.board[botMove(g.board)] = 'o'
    w = winner(g.board)
    if (w) { await finish(sock, ns, jid, g, w, msg); return 'ok' }
    g.turn = 'x'
  }
  await tttShow(sock, jid, g, msg)
  return 'ok'
}

export function tttTop(ns, jid) {
  return Object.values(expertGet(ns, `ttt:${jid}`, {})).sort((a, b) => b.w - a.w || a.l - b.l).slice(0, 5)
}
