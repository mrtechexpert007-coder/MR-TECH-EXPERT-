// ⟦EXPERT⟧ keeps libsignal's console spam (and the private keys it prints) out of the logs.
// Import this FIRST in index.js. Suppressed lines are counted and summarised once a minute.
const orig = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
}

const NOISY = [
  'Closing session',
  'Closing open session',
  'Removing old closed session',
  'Migrating session',
  'Decrypted message with closed session',
  'Failed to decrypt message with any known session',
  'Session error',
  'Bad MAC'
]

const isSessionDump = (v) =>
  v && typeof v === 'object' && !(v instanceof Error) &&
  (v._chains || v.currentRatchet || v.indexInfo || v.pendingPreKey || v.registrationId)

const isNoisy = (args) => args.some((a) => {
  if (typeof a === 'string') return NOISY.some((n) => a.includes(n))
  if (a instanceof Error) return NOISY.some((n) => String(a.message).includes(n))
  return isSessionDump(a)
})

let suppressed = 0
for (const level of ['log', 'info', 'warn', 'error']) {
  console[level] = (...args) => {
    if (isNoisy(args)) { suppressed++; return }
    orig[level](...args)
  }
}

setInterval(() => {
  if (!suppressed) return
  orig.log(`\x1b[33m[EXPERT]\x1b[0m ${suppressed} Signal session/decrypt log lines hidden in the last minute`)
  suppressed = 0
}, 60_000).unref()
