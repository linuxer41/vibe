const WebSocket = require('ws')
const http = require('http')
const { MessageType } = require('../lib/message-types')
const { Flags } = require('../lib/flags')
const { encodeFrame, decodeFrame, HEADER_SIZE, MAGIC } = require('../lib/frame')

// Increase timeout for integration tests
jest.setTimeout(30000)

let server
let wss
const PORT = 3099

function startServer() {
  return new Promise((resolve) => {
    const express = require('express')
    const { WebSocketServer } = require('ws')
    const app = express()
    server = http.createServer(app)
    wss = new WebSocketServer({ server })

    // Minimal mock server — just enough to test protocol
    wss.on('connection', (ws, req) => {
      ws.on('message', (raw) => {
        const frame = decodeFrame(raw)
        if (!frame) return

        // Handle ping → pong
        if (frame.type === MessageType.Ping) {
          ws.send(encodeFrame(MessageType.Pong, Flags.NONE, frame.streamId))
          return
        }

        // Echo back with RESPONSE flag for any request
        if (frame.flags & Flags.REQUEST) {
          ws.send(encodeFrame(frame.type, Flags.RESPONSE, frame.streamId,
            Buffer.from(JSON.stringify({ ok: true, echo: true, type: frame.type }))))
        }
      })
    })

    server.listen(PORT, () => resolve())
  })
}

function stopServer() {
  return new Promise((resolve) => {
    if (wss) wss.close()
    if (server) server.close(() => resolve())
    else resolve()
  })
}

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
    ws.binaryType = 'arraybuffer'
  })
}

function sendFrame(ws, type, flags = Flags.NONE, streamId = 0, payload) {
  return new Promise((resolve, reject) => {
    const frame = encodeFrame(type, flags, streamId, payload)
    ws.send(frame)

    ws.onmessage = (event) => {
      const resp = decodeFrame(event.data)
      if (resp) resolve(resp)
      else reject(new Error('Invalid response frame'))
    }
  })
}

beforeAll(async () => {
  await startServer()
})

afterAll(async () => {
  await stopServer()
})

describe('Binary Frame Protocol', () => {
  test('Frame header structure', () => {
    const payload = Buffer.from('hello')
    const frame = encodeFrame(MessageType.ChatSend, Flags.REQUEST, 42, payload)
    const buf = Buffer.from(frame)
    expect(buf.length).toBe(HEADER_SIZE + 5)
    expect(buf.readUInt16BE(0)).toBe(MAGIC)
    expect(buf.readUInt16BE(2)).toBe(MessageType.ChatSend)
    expect(buf.readUInt16BE(4)).toBe(Flags.REQUEST)
    expect(buf.readUInt32BE(6)).toBe(42)
    expect(buf.readUInt32BE(10)).toBe(5)
    expect(buf.slice(HEADER_SIZE).toString()).toBe('hello')
  })

  test('Decode validates magic', () => {
    const bad = Buffer.alloc(HEADER_SIZE)
    const result = decodeFrame(bad)
    expect(result).toBeNull()
  })

  test('Decode checks minimum size', () => {
    const bad = Buffer.alloc(10)
    const result = decodeFrame(bad)
    expect(result).toBeNull()
  })

  test('Ping → Pong', async () => {
    const ws = await connect()
    const frame = encodeFrame(MessageType.Ping, Flags.NONE, 0)
    ws.send(frame)

    const resp = await new Promise((resolve) => {
      ws.onmessage = (event) => resolve(decodeFrame(event.data))
    })
    expect(resp.type).toBe(MessageType.Pong)
    ws.close()
  })

  test('Request → Response with stream ID', async () => {
    const ws = await connect()
    ws.send(encodeFrame(MessageType.ChatSend, Flags.REQUEST, 7, Buffer.from(JSON.stringify({ text: 'hi' }))))

    const resp = await new Promise((resolve) => {
      ws.onmessage = (event) => resolve(decodeFrame(event.data))
    })
    expect(resp.flags & Flags.RESPONSE).toBeTruthy()
    expect(resp.streamId).toBe(7)
    const data = JSON.parse(new TextDecoder().decode(resp.payload))
    expect(data.ok).toBe(true)
    expect(data.echo).toBe(true)
    ws.close()
  })

  test('Multiple stream IDs are independent', async () => {
    const ws = await connect()

    // Send 3 requests with different stream IDs
    ws.send(encodeFrame(MessageType.ChatGetChats, Flags.REQUEST, 100))
    ws.send(encodeFrame(MessageType.ChatSend, Flags.REQUEST, 101))
    ws.send(encodeFrame(MessageType.ChatMarkRead, Flags.REQUEST, 102))

    const responses = []
    for (let i = 0; i < 3; i++) {
      const resp = await new Promise((resolve) => {
        ws.onmessage = (event) => resolve(decodeFrame(event.data))
      })
      responses.push(resp)
    }

    const streamIds = responses.map(r => r.streamId).sort()
    expect(streamIds).toEqual([100, 101, 102])
    ws.close()
  })

  test('Send (no response expected) does not get response', async () => {
    const ws = await connect()

    // Send without REQUEST flag — no response expected
    ws.send(encodeFrame(MessageType.ChatTyping, Flags.NONE, 0, Buffer.from(JSON.stringify({ chatId: 1 }))))

    // Wait a bit to ensure no response comes
    let gotResponse = false
    ws.onmessage = () => { gotResponse = true }
    await new Promise(r => setTimeout(r, 500))
    expect(gotResponse).toBe(false)
    ws.close()
  })

  test('Auth message types exist', () => {
    expect(MessageType.AuthSendCode).toBe(257)
    expect(MessageType.AuthSendCodeResp).toBe(258)
    expect(MessageType.AuthVerifyCode).toBe(259)
    expect(MessageType.AuthVerifyCodeResp).toBe(260)
    expect(MessageType.AuthRestore).toBe(261)
    expect(MessageType.AuthRestoreResp).toBe(262)
  })

  test('All chat message types exist', () => {
    expect(MessageType.ChatSend).toBe(513)
    expect(MessageType.ChatSendResp).toBe(514)
    expect(MessageType.ChatNewMessage).toBe(515)
    expect(MessageType.ChatGetChats).toBe(516)
    expect(MessageType.ChatGetChatsResp).toBe(517)
    expect(MessageType.ChatGetMessages).toBe(518)
    expect(MessageType.ChatGetMessagesResp).toBe(519)
    expect(MessageType.ChatMarkRead).toBe(520)
    expect(MessageType.ChatTyping).toBe(521)
    expect(MessageType.ChatStopTyping).toBe(522)
    expect(MessageType.ChatMessageDelivered).toBe(523)
    expect(MessageType.ChatMessageStatus).toBe(524)
  })

  test('All domain message types exist', () => {
    // Presence
    expect(MessageType.PresenceStatus).toBe(769)
    // Upload
    expect(MessageType.UploadStart).toBe(1025)
    expect(MessageType.UploadStartResp).toBe(1026)
    expect(MessageType.UploadChunk).toBe(1027)
    expect(MessageType.UploadChunkResp).toBe(1028)
    expect(MessageType.UploadCancel).toBe(1029)
    // Call
    expect(MessageType.CallStart).toBe(1281)
    expect(MessageType.CallStartResp).toBe(1282)
    // Post
    expect(MessageType.PostCreate).toBe(1537)
    expect(MessageType.PostGet).toBe(1539)
    expect(MessageType.PostLike).toBe(1541)
    // Live
    expect(MessageType.LiveStart).toBe(1793)
    expect(MessageType.LiveGetActive).toBe(1795)
    // Notification
    expect(MessageType.NotifNew).toBe(2817)
    expect(MessageType.NotifMarkRead).toBe(2818)
    // Profile
    expect(MessageType.ProfileUpdate).toBe(3073)
    expect(MessageType.ProfileGet).toBe(3075)
    // Contact
    expect(MessageType.ContactAdd).toBe(3329)
    expect(MessageType.ContactGet).toBe(3331)
    expect(MessageType.ContactStatus).toBe(3333)
    // Game
    expect(MessageType.GameGetList).toBe(3585)
    expect(MessageType.GameCreate).toBe(3587)
    expect(MessageType.GameAction).toBe(3590)
    // Channel
    expect(MessageType.ChannelGetList).toBe(3841)
    expect(MessageType.ChannelCreate).toBe(3843)
    expect(MessageType.ChannelSubscribe).toBe(3848)
    expect(MessageType.CommunityGetList).toBe(3850)
    expect(MessageType.CommunityCreate).toBe(3852)
    // Shop
    expect(MessageType.ShopGetProducts).toBe(4097)
    expect(MessageType.ShopCreateProduct).toBe(4099)
    expect(MessageType.ShopBuyProduct).toBe(4100)
    expect(MessageType.ShopGetFlashDeals).toBe(4103)
    // Watch
    expect(MessageType.WatchCreate).toBe(4353)
    expect(MessageType.WatchSync).toBe(4355)
    // Story
    expect(MessageType.StoryCreate).toBe(4609)
    expect(MessageType.StoryGet).toBe(4611)
    // Task
    expect(MessageType.TaskGetList).toBe(4865)
    expect(MessageType.TaskCreate).toBe(4867)
    expect(MessageType.TaskComplete).toBe(4869)
    // Note
    expect(MessageType.NoteGet).toBe(5121)
    expect(MessageType.NoteSave).toBe(5123)
    // Focus
    expect(MessageType.FocusStart).toBe(5377)
    expect(MessageType.FocusEnd).toBe(5379)
    // CallHistory
    expect(MessageType.CallHistoryGet).toBe(5633)
    expect(MessageType.CallHistoryGetResp).toBe(5634)
    // Meme
    expect(MessageType.MemeGetList).toBe(5889)
    expect(MessageType.MemeCreate).toBe(5891)
    expect(MessageType.MemeLike).toBe(5892)
    // Sticker
    expect(MessageType.StickerGetPacks).toBe(6145)
    expect(MessageType.StickerGetMy).toBe(6147)
    expect(MessageType.StickerGetAll).toBe(6149)
    expect(MessageType.StickerPurchase).toBe(6151)
    // Search
    expect(MessageType.SearchUsers).toBe(6401)
    expect(MessageType.SearchMessages).toBe(6403)
    expect(MessageType.SearchPosts).toBe(6405)
    // Vibe Balance
    expect(MessageType.VibeBalanceGet).toBe(6657)
    expect(MessageType.RecordInteraction).toBe(6659)
    // Sessions
    expect(MessageType.SessionGetList).toBe(6913)
    expect(MessageType.SessionTerminate).toBe(6915)
    // Privacy
    expect(MessageType.PrivacyGet).toBe(7169)
    expect(MessageType.PrivacyUpdate).toBe(7171)
    // Blocked
    expect(MessageType.BlockedGetList).toBe(7425)
    expect(MessageType.BlockedUnblock).toBe(7427)
    // Account
    expect(MessageType.AccountGetDeletion).toBe(7681)
    expect(MessageType.AccountScheduleDelete).toBe(7683)
    // TwoStep
    expect(MessageType.TwoStepGetStatus).toBe(7937)
    expect(MessageType.TwoStepSet).toBe(7939)
    expect(MessageType.TwoStepDisable).toBe(7940)
  })

  test('Frame with zero-length payload', () => {
    const frame = encodeFrame(MessageType.Ping, Flags.NONE, 0)
    const buf = Buffer.from(frame)
    expect(buf.length).toBe(HEADER_SIZE)
    expect(buf.readUInt32BE(10)).toBe(0)
  })

  test('Frame with large JSON payload', () => {
    const large = { data: 'x'.repeat(10000) }
    const payload = Buffer.from(JSON.stringify(large))
    const frame = encodeFrame(MessageType.PostGet, Flags.REQUEST, 1, payload)
    const decoded = decodeFrame(frame)
    expect(decoded.payloadLength).toBe(10004) // "x" * 10000 + JSON wrapping
  })

  test('Flags work correctly', () => {
    const request = encodeFrame(MessageType.ChatSend, Flags.REQUEST, 1)
    const resp = decodeFrame(request)
    expect(resp.flags & Flags.REQUEST).toBeTruthy()
    expect(resp.flags & Flags.RESPONSE).toBeFalsy()
    expect(resp.flags & Flags.ERROR).toBeFalsy()

    const err = encodeFrame(MessageType.ChatSend, Flags.RESPONSE | Flags.ERROR, 1)
    const errDecoded = decodeFrame(err)
    expect(errDecoded.flags & Flags.RESPONSE).toBeTruthy()
    expect(errDecoded.flags & Flags.ERROR).toBeTruthy()
  })
})
