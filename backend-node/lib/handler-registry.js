// Shared handler registry — called once by index.js
// Prevents double-registration when both WS and TCP servers start

const ph = require('../protocol-handler')
const { MessageType } = require('./message-types')

let registered = false

function registerAll() {
  if (registered) return
  registered = true

  function reg(type, handler) { ph.register(type, handler) }

  require('../handlers/auth').register(reg)
  require('../handlers/chat').register(reg)
  const generic = require('../handlers/generic')
  generic.register(reg)

  // Upload handlers
  reg(MessageType.UploadStart, generic.handleUploadStart)
  reg(MessageType.UploadChunk, generic.handleUploadChunk)
  reg(MessageType.UploadCancel, generic.handleUploadCancel)
}

module.exports = { registerAll }
