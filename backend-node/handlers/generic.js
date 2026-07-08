// Generic handlers for all remaining message types
// Each handler decodes JSON payload, calls db function, returns JSON response

const { MessageType } = require('../lib/message-types')
const { encodeResponse, encodeError, encodeFrame } = require('../lib/frame')
const { Flags } = require('../lib/flags')
const db = require('../db/init')

function jsonPayload(frame) {
  if (!frame.payload || frame.payload.byteLength === 0) return {}
  try { return JSON.parse(new TextDecoder().decode(frame.payload)) }
  catch { return {} }
}

function respond(ws, frame, data) {
  ws.send(encodeResponse(frame, Buffer.from(JSON.stringify(data))))
}

function err(ws, frame, msg) {
  ws.send(encodeError(frame, msg))
}

function register(reg) {
  // ── Call / WebRTC ──
  reg(MessageType.CallStart, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const call = await db.createActiveCall(user.id, data.targetId, data.type || 'audio')
      respond(ws, frame, { ok: true, call })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.CallGetHistory, async (ws, user, frame) => {
    try {
      const calls = await db.getUserCalls(user.id)
      respond(ws, frame, calls || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.CallLog, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try { await db.addCall(user.id, data.targetId, data.type, data.duration); respond(ws, frame, { ok: true }) }
    catch (e) { respond(ws, frame, { ok: false }) }
  })

  // ── Post / Feed ──
  reg(MessageType.PostCreate, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const post = await db.createPost(user.id, data.text, data.type || 'text', data.media || null)
      respond(ws, frame, { ok: true, post })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.PostGet, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const posts = data?.type === 'recommended'
        ? await db.getRecommendedPosts(user.id)
        : data?.userId
          ? await db.getPosts(data.userId)
          : await db.getPosts()
      respond(ws, frame, posts || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.PostLike, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try { await db.likePost(user.id, data.postId); respond(ws, frame, { ok: true }) }
    catch (e) { respond(ws, frame, { ok: false }) }
  })

  reg(MessageType.PostComment, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const comment = await db.addPostComment(user.id, data.postId, data.text, data.parentId || null)
      respond(ws, frame, { ok: true, comment })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.PostGetRecommended, async (ws, user, frame) => {
    try {
      const posts = await db.getRecommendedPosts(user.id)
      respond(ws, frame, posts || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.PostSearch, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const results = await db.searchPosts(data.query)
      respond(ws, frame, results || [])
    } catch (e) { respond(ws, frame, []) }
  })

  // ── Live ──
  reg(MessageType.LiveStart, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const live = await db.startLive(user.id, data.title || '')
      respond(ws, frame, { ok: true, live })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.LiveEnd, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try { await db.endLive(data.liveId); respond(ws, frame, { ok: true }) }
    catch (e) { respond(ws, frame, { ok: false }) }
  })

  reg(MessageType.LiveGetActive, async (ws, user, frame) => {
    try {
      const lives = await db.getActiveLives()
      respond(ws, frame, lives || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.LiveComment, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const comment = await db.addLiveComment(data.liveId, user.id, data.text)
      respond(ws, frame, { ok: true, comment })
    } catch (e) { respond(ws, frame, { ok: false }) }
  })

  reg(MessageType.LiveReaction, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const reaction = await db.addLiveReaction(data.liveId, user.id, data.reaction)
      respond(ws, frame, { ok: true, reaction })
    } catch (e) { respond(ws, frame, { ok: false }) }
  })

  reg(MessageType.LiveGift, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const gift = await db.sendLiveGift(user.id, data.liveId, data.stars, data.giftType)
      respond(ws, frame, { ok: true, gift })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.LiveGetComments, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const comments = await db.getLiveComments(data.liveId)
      respond(ws, frame, comments || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.LiveGetReactions, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const reactions = await db.getLiveReactions(data.liveId)
      respond(ws, frame, reactions || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.LiveGetGifts, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const gifts = await db.getLiveGifts(data.liveId)
      respond(ws, frame, gifts || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.LiveGetUserStars, async (ws, user, frame) => {
    try {
      const balance = await db.getUserStars(user.id)
      respond(ws, frame, { stars: balance?.stars || 0 })
    } catch (e) { respond(ws, frame, { stars: 0 }) }
  })

  // ── Contact ──
  reg(MessageType.ContactGet, async (ws, user, frame) => {
    try {
      const contacts = await db.getContacts(user.id)
      respond(ws, frame, contacts || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.ContactAdd, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      await db.addContact(user.id, data.contactId)
      respond(ws, frame, { ok: true })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.ContactSearch, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const results = await db.searchUsers(data.query)
      respond(ws, frame, results || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.ContactGetSuggested, async (ws, user, frame) => {
    try {
      const users = await db.getSuggestedUsers(user.id)
      respond(ws, frame, users || [])
    } catch (e) { respond(ws, frame, []) }
  })

  // ── Profile ──
  reg(MessageType.ProfileGet, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const profile = await db.getUserById(data.userId || user.id)
      respond(ws, frame, profile || {})
    } catch (e) { respond(ws, frame, {}) }
  })

  reg(MessageType.ProfileUpdate, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const updated = await db.updateProfile(user.id, data)
      respond(ws, frame, { ok: true, user: updated })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  // ── Notification ──
  reg(MessageType.NotifGetList, async (ws, user, frame) => {
    try {
      const notifs = await db.getSmartNotifications(user.id)
      respond(ws, frame, notifs || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.NotifMarkRead, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try { await db.markNotificationRead(data.notificationId); respond(ws, frame, { ok: true }) }
    catch (e) { respond(ws, frame, { ok: false }) }
  })

  // ── Channel ──
  reg(MessageType.ChannelGetList, async (ws, user, frame) => {
    try {
      const channels = await db.getChannels()
      respond(ws, frame, channels || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.ChannelCreate, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const ch = await db.createChannel(user.id, data.name, data.description || '')
      respond(ws, frame, { ok: true, channel: ch })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.ChannelGetPosts, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const posts = await db.getChannelPosts(data.channelId)
      respond(ws, frame, posts || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.ChannelCreatePost, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const post = await db.createChannelPost(user.id, data.channelId, data.text, data.media || null)
      respond(ws, frame, { ok: true, post })
    } catch (e) { respond(ws, frame, { ok: false }) }
  })

  // ── Community ──
  reg(MessageType.CommunityGetList, async (ws, user, frame) => {
    try {
      const communities = await db.getCommunities()
      respond(ws, frame, communities || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.CommunityCreate, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const c = await db.createCommunity(user.id, data.name, data.description || '')
      respond(ws, frame, { ok: true, community: c })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  // ── Shop ──
  reg(MessageType.ShopGetProducts, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const products = await db.getProducts(data?.category || '')
      respond(ws, frame, products || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.ShopGetFlashDeals, async (ws, user, frame) => {
    try {
      const deals = await db.getFlashDeals()
      respond(ws, frame, deals || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.ShopGetOrders, async (ws, user, frame) => {
    try {
      const orders = await db.getMyOrders(user.id)
      respond(ws, frame, orders || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.ShopGetWishlists, async (ws, user, frame) => {
    try {
      const lists = await db.getWishlists(user.id)
      respond(ws, frame, lists || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.ShopCreateProduct, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const p = await db.createProduct(user.id, data.name, data.price, data.description || '', data.image || '')
      respond(ws, frame, { ok: true, product: p })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.ShopBuyProduct, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const order = await db.createOrder(user.id, data.productId)
      respond(ws, frame, { ok: true, order })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.ShopAddToWishlist, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try { await db.addToWishlist(user.id, data.productId); respond(ws, frame, { ok: true }) }
    catch (e) { respond(ws, frame, { ok: false }) }
  })

  reg(MessageType.ShopCreateWishlist, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const wl = await db.createWishlist(user.id, data.name)
      respond(ws, frame, { ok: true, wishlist: wl })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  // ── Game ──
  reg(MessageType.GameGetList, async (ws, user, frame) => {
    try {
      const games = await db.getAvailableGames()
      respond(ws, frame, games || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.GameCreate, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const session = await db.createGameSession(user.id, data.gameId)
      respond(ws, frame, { ok: true, session })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  // ── Watch ──
  reg(MessageType.WatchCreate, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const session = await db.createWatchSession(user.id, data.videoUrl, data.syncType || 'external')
      respond(ws, frame, { ok: true, session })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.WatchGet, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const session = await db.getWatchSession(data.sessionId)
      respond(ws, frame, session || {})
    } catch (e) { respond(ws, frame, {}) }
  })

  // ── Story ──
  reg(MessageType.StoryCreate, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const story = await db.createStory(user.id, data.media, data.type || 'image')
      respond(ws, frame, { ok: true, story })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.StoryGet, async (ws, user, frame) => {
    try {
      const stories = await db.getStories()
      respond(ws, frame, stories || [])
    } catch (e) { respond(ws, frame, []) }
  })

  // ── Task ──
  reg(MessageType.TaskGetList, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const tasks = await db.getTasks(data.chatId)
      respond(ws, frame, tasks || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.TaskCreate, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const task = await db.createTask(data.chatId, data.title, user.id)
      respond(ws, frame, { ok: true, task })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.TaskComplete, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try { await db.completeTask(data.taskId); respond(ws, frame, { ok: true }) }
    catch (e) { respond(ws, frame, { ok: false }) }
  })

  reg(MessageType.TaskDelete, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try { await db.deleteTask(data.taskId); respond(ws, frame, { ok: true }) }
    catch (e) { respond(ws, frame, { ok: false }) }
  })

  // ── Note ──
  reg(MessageType.NoteGet, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const note = await db.getSharedNote(data.userId, user.id)
      respond(ws, frame, note || {})
    } catch (e) { respond(ws, frame, {}) }
  })

  reg(MessageType.NoteSave, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const note = await db.saveSharedNote(user.id, data.targetUserId, data.text)
      respond(ws, frame, { ok: true, note })
    } catch (e) { respond(ws, frame, { ok: false }) }
  })

  // ── Focus ──
  reg(MessageType.FocusStart, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const session = await db.startFocusSession(user.id, data.mode || 'focus')
      respond(ws, frame, { ok: true, session })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.FocusEnd, async (ws, user, frame) => {
    try {
      const result = await db.endFocusSession(user.id)
      respond(ws, frame, { ok: true, result })
    } catch (e) { respond(ws, frame, { ok: false }) }
  })

  // ── Meme ──
  reg(MessageType.MemeGetList, async (ws, user, frame) => {
    try {
      const memes = await db.getMemes()
      respond(ws, frame, memes || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.MemeCreate, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const meme = await db.createMeme(user.id, data.image, data.text || '')
      respond(ws, frame, { ok: true, meme })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.MemeLike, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try { await db.likeMeme(user.id, data.memeId); respond(ws, frame, { ok: true }) }
    catch (e) { respond(ws, frame, { ok: false }) }
  })

  // ── Sticker ──
  reg(MessageType.StickerGetPacks, async (ws, user, frame) => {
    try {
      const packs = await db.getStickerPacks()
      respond(ws, frame, packs || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.StickerGetMy, async (ws, user, frame) => {
    try {
      const stickers = await db.getMyStickers(user.id)
      respond(ws, frame, stickers || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.StickerGetAll, async (ws, user, frame) => {
    try {
      const stickers = await db.getStickers()
      respond(ws, frame, stickers || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.StickerPurchase, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const sticker = await db.purchaseSticker(user.id, data.stickerPackId)
      respond(ws, frame, { ok: true, sticker })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  // ── Search ──
  reg(MessageType.SearchUsers, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const results = await db.searchUsers(data.query)
      respond(ws, frame, results || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.SearchMessages, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const results = await db.searchMessages(data.chatId, data.query)
      respond(ws, frame, results || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.SearchPosts, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      const results = await db.searchPosts(data.query)
      respond(ws, frame, results || [])
    } catch (e) { respond(ws, frame, []) }
  })

  // ── Vibe Balance ──
  reg(MessageType.VibeBalanceGet, async (ws, user, frame) => {
    try {
      const balance = await db.getVibeBalance(user.id)
      respond(ws, frame, balance || {})
    } catch (e) { respond(ws, frame, {}) }
  })

  reg(MessageType.RecordInteraction, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try { await db.recordInteraction(user.id, data.postId, data.type); respond(ws, frame, { ok: true }) }
    catch (e) { respond(ws, frame, { ok: false }) }
  })

  // ── Sessions ──
  reg(MessageType.SessionGetList, async (ws, user, frame) => {
    try {
      const sessions = await db.getUserSessions(user.id)
      respond(ws, frame, sessions || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.SessionTerminate, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try { await db.terminateSession(data.sessionId); respond(ws, frame, { ok: true }) }
    catch (e) { respond(ws, frame, { ok: false }) }
  })

  reg(MessageType.SessionTerminateAll, async (ws, user, frame) => {
    try { await db.terminateOtherSessions(user.id); respond(ws, frame, { ok: true }) }
    catch (e) { respond(ws, frame, { ok: false }) }
  })

  // ── Privacy ──
  reg(MessageType.PrivacyGet, async (ws, user, frame) => {
    try {
      const settings = await db.getPrivacySettings(user.id)
      respond(ws, frame, settings || {})
    } catch (e) { respond(ws, frame, {}) }
  })

  reg(MessageType.PrivacyUpdate, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      await db.updatePrivacySettings(user.id, data)
      respond(ws, frame, { ok: true })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  // ── Blocked ──
  reg(MessageType.BlockedGetList, async (ws, user, frame) => {
    try {
      const blocked = await db.getBlockedUsers(user.id)
      respond(ws, frame, blocked || [])
    } catch (e) { respond(ws, frame, []) }
  })

  reg(MessageType.BlockedUnblock, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try { await db.unblockUser(user.id, data.userId); respond(ws, frame, { ok: true }) }
    catch (e) { respond(ws, frame, { ok: false }) }
  })

  // ── Account ──
  reg(MessageType.AccountGetDeletion, async (ws, user, frame) => {
    try {
      const info = await db.getAccountDeletion(user.id)
      respond(ws, frame, info || {})
    } catch (e) { respond(ws, frame, {}) }
  })

  reg(MessageType.AccountScheduleDelete, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      await db.scheduleAccountDeletion(user.id, data.delayDays || 7)
      respond(ws, frame, { ok: true })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.AccountCancelDelete, async (ws, user, frame) => {
    try { await db.cancelAccountDeletion(user.id); respond(ws, frame, { ok: true }) }
    catch (e) { respond(ws, frame, { ok: false }) }
  })

  // ── TwoStep ──
  reg(MessageType.TwoStepGetStatus, async (ws, user, frame) => {
    try {
      const status = await db.getTwoStepStatus(user.id)
      respond(ws, frame, status || { enabled: false })
    } catch (e) { respond(ws, frame, { enabled: false }) }
  })

  reg(MessageType.TwoStepSet, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      await db.setTwoStepPassword(user.id, data.password)
      respond(ws, frame, { ok: true })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  reg(MessageType.TwoStepDisable, async (ws, user, frame) => {
    const data = jsonPayload(frame)
    try {
      await db.disableTwoStep(user.id, data.password)
      respond(ws, frame, { ok: true })
    } catch (e) { respond(ws, frame, { ok: false, error: e.message }) }
  })

  // ── Call / WebRTC: Accept, Reject, End, Ice (fire-and-forget via send) ──
  reg(MessageType.CallAccept, (ws, user, frame) => {
    const data = jsonPayload(frame)
    db.updateCallStatus(data.callId, 'accepted').catch(() => {})
  })
  reg(MessageType.CallReject, (ws, user, frame) => {
    const data = jsonPayload(frame)
    db.updateCallStatus(data.callId, 'rejected').catch(() => {})
  })
  reg(MessageType.CallEnd, (ws, user, frame) => {
    const data = jsonPayload(frame)
    db.endActiveCall(data.callId).catch(() => {})
  })
}

// ── Upload handlers (used by server-ws.js directly) ──
const CHUNK_SIZE = 65536
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const TEMP_DIR = path.resolve(__dirname, '..', 'tmp_upload')
const CHUNK_DIR = path.resolve(__dirname, '..', 'tmp_chunks')

async function handleUploadStart(ws, user, frame) {
  const data = jsonPayload(frame)
  const uploadId = crypto.randomUUID()
  const info = { uploadId, name: data.name, mime: data.mime || 'application/octet-stream', size: data.size || 0, totalChunks: data.totalChunks || 0, chunks: [] }
  fs.writeFileSync(path.join(CHUNK_DIR, `${uploadId}.json`), JSON.stringify(info))
  respond(ws, frame, { ok: true, uploadId })
}

async function handleUploadChunk(ws, user, frame) {
  const data = jsonPayload(frame)
  const infoPath = path.join(CHUNK_DIR, `${data.uploadId}.json`)
  if (!fs.existsSync(infoPath)) { respond(ws, frame, { ok: false, error: 'Upload no encontrado' }); return }
  const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'))
  const chunkPath = path.join(CHUNK_DIR, `${data.uploadId}_${data.index}`)
  // payload contains the raw chunk data after the JSON header
  const payloadView = new Uint8Array(frame.payload)
  // Find where JSON ends and chunk data begins: first byte after '}'
  // We re-encode the chunk from the frame payload
  if (data.data && typeof data.data === 'string') {
    // chunk data is base64-encoded in JSON
    fs.writeFileSync(chunkPath, Buffer.from(data.data, 'base64'))
  }
  info.chunks.push(data.index)
  fs.writeFileSync(infoPath, JSON.stringify(info))

  if (info.chunks.length >= info.totalChunks) {
    // All chunks received: reassemble
    const finalBuf = Buffer.alloc(info.size)
    let offset = 0
    for (let i = 0; i < info.totalChunks; i++) {
      const c = fs.readFileSync(path.join(CHUNK_DIR, `${data.uploadId}_${i}`))
      c.copy(finalBuf, offset)
      offset += c.length
      fs.unlinkSync(path.join(CHUNK_DIR, `${data.uploadId}_${i}`))
    }
    fs.unlinkSync(infoPath)

    const filename = `${crypto.randomUUID()}_${info.name}`
    const destPath = path.join(TEMP_DIR, filename)
    fs.writeFileSync(destPath, finalBuf)

    respond(ws, frame, { ok: true, url: `/uploads/${filename}`, metadata: { name: info.name, mime: info.mime, size: info.size } })
  } else {
    respond(ws, frame, { ok: true })
  }
}

function handleUploadCancel(ws, user, frame) {
  const data = jsonPayload(frame)
  const infoPath = path.join(CHUNK_DIR, `${data.uploadId}.json`)
  if (fs.existsSync(infoPath)) {
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'))
    for (let i = 0; i < (info.totalChunks || 0); i++) {
      const cp = path.join(CHUNK_DIR, `${data.uploadId}_${i}`)
      if (fs.existsSync(cp)) fs.unlinkSync(cp)
    }
    fs.unlinkSync(infoPath)
  }
  respond(ws, frame, { ok: true })
}

module.exports = { register, handleUploadStart, handleUploadChunk, handleUploadCancel }
