// ⟦EXPERT⟧ single doorway to the Baileys fork (github.com/RennZSync/baileys → @rennzsync/baileys)
import * as B from '@rennzsync/baileys'

export const expertMakeSock = B.default || B.makeWASocket
export const {
  useMultiFileAuthState: expertAuthState,
  makeCacheableSignalKeyStore: expertKeyStore,
  fetchLatestBaileysVersion: expertLatestVersion,
  DisconnectReason: ExpertDisconnect,
  Browsers: ExpertBrowsers,
  BufferJSON: expertBufferJSON,
  initAuthCreds: expertInitCreds,
  proto: expertProto,
  buildButtonsMessage: expertBuildButtons,
  sendClassicMessage: expertSendClassic,
  generateWAMessageFromContent: expertGenMsg,
  prepareWAMessageMedia: expertPrepMedia,
  generateWAMessageContent: expertGenContent
} = B

if (typeof expertMakeSock !== 'function') {
  throw new Error('[EXPERT] @rennzsync/baileys did not export makeWASocket — check the install')
}
