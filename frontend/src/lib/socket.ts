import { get } from 'svelte/store'
import { MessageType } from './message-types'
import { WsTransport } from './protocol/transport/ws-transport'
import { TauriTransport } from './protocol/transport/tauri-transport'
import { MessageBus, type MessageHandler } from './protocol/message-bus'
import type { Frame } from './protocol/frame'
import { socket as socketStore, showToast } from './stores'
import { getEventEntry, getPushType } from './event-map'
import { Flags } from './protocol/flags'
import { getBackendConfig } from './backend-config'

let activeBus: MessageBus | null = null

function isTauri(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).__TAURI__ !== 'undefined'
}

let _idCounter = 0

export function createSocket(token?: string) {
  const cfg = getBackendConfig()
  const isTauriEnv = isTauri()
  const transport = isTauriEnv
    ? new TauriTransport(cfg.tcpUrl)
    : new WsTransport(cfg.wsUrl, 3000, 3)
  const bus = new MessageBus(transport)
  const listenerMap = new Map<string, Set<(...args: any[]) => void>>()

  const connectErrorHandlers: Array<(err: Error) => void> = []

  transport.onError((err) => {
    const cb = connectErrorHandlers[0]
    if (cb && !transport.isConnected) cb(err)
  })

  transport.onClose(() => {
    const cb = connectErrorHandlers[0]
    if (cb && !transport.isConnected) cb(new Error('Connection closed'))
  })

  // Wire push events (server → client)
  bus.on(MessageType.ChatNewMessage, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('new_message', data)
  })
  bus.on(MessageType.ChatMessageStatus, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('message_status', data)
  })
  bus.on(MessageType.ChatNewChat, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('new_chat', data)
  })
  bus.on(MessageType.ContactStatus, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('contact_status', data)
  })
  bus.on(MessageType.PostNew, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('new_post', data)
  })
  bus.on(MessageType.StoryNew, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('new_story', data)
  })
  bus.on(MessageType.NotifNew, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('new_notification', data)
  })
  bus.on(MessageType.ChatTyping, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('typing', data)
  })
  bus.on(MessageType.ChatStopTyping, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('stop_typing', data)
  })
  bus.on(MessageType.LiveNewComment, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('new_live_comment', data)
  })
  bus.on(MessageType.LiveNewReaction, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('new_live_reaction', data)
  })
  bus.on(MessageType.LiveNewGift, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('new_live_gift', data)
  })
  bus.on(MessageType.MemeNew, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('new_meme', data)
  })
  bus.on(MessageType.TaskNew, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('new_task', data)
  })
  bus.on(MessageType.FocusStarted, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('focus_started', data)
  })
  bus.on(MessageType.FocusEnded, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('focus_ended', data)
  })
  bus.on(MessageType.NoteUpdated, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('note_updated', data)
  })
  bus.on(MessageType.WatchSynced, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('watch_synced', data)
  })
  bus.on(MessageType.WatchSessionUpdated, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('session_updated', data)
  })
  bus.on(MessageType.GameUpdate, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('game_update', data)
  })
  bus.on(MessageType.CallEnd, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('call_ended', data)
  })
  bus.on(MessageType.PresenceStatus, (frame) => {
    const data = parseJsonPayload(frame)
    if (data) emitToListeners('contact_status', data)
  })
  bus.on(MessageType.Error, (frame) => {
    const text = new TextDecoder().decode(frame.payload)
    emitToListeners('error', { error: text })
  })

  function parseJsonPayload(frame: Frame): any {
    if (!frame.payload || frame.payload.byteLength === 0) return null
    try {
      return JSON.parse(new TextDecoder().decode(frame.payload))
    } catch { return null }
  }

  function emitToListeners(event: string, ...args: any[]) {
    const handlers = listenerMap.get(event)
    if (handlers) {
      for (const h of handlers) h(...args)
    }
  }

  const proxy = {
    get id() { return `ws_${_idCounter++}` },
    get connected() { return transport.isConnected },

    connect() {
      const result = transport.connect(token)
      if (result instanceof Promise) {
        result.catch((err: Error) => {
          const cb = connectErrorHandlers[0]
          if (cb && !transport.isConnected) cb(err)
        })
      }
    },
    close() {
      bus.destroy()
      transport.close()
      if (activeBus === bus) activeBus = null
    },
    disconnect() {
      this.close()
    },

    emit(event: string, data?: any, callback?: (res: any) => void) {
      const entry = getEventEntry(event)
      if (!entry) {
        const err = new Error(`Event '${event}' no migrado a protocolo binario`)
        if (callback) callback({ ok: false, error: err.message })
        return
      }

      const payload = data !== undefined
        ? new TextEncoder().encode(JSON.stringify(data)).buffer as ArrayBuffer
        : undefined

      if (entry.mode === 'request') {
        bus.request(entry.type, payload).then(raw => {
          const text = new TextDecoder().decode(raw)
          let res: any
          try { res = JSON.parse(text) } catch { res = { ok: true } }
          if (callback) callback(res)
        }).catch(err => {
          if (callback) callback({ ok: false, error: err.message })
        })
      } else {
        bus.send(entry.type, payload)
        if (callback) callback({ ok: true })
      }
    },

    on(event: string, handler: (...args: any[]) => void) {
      if (event === 'connect_error') {
        connectErrorHandlers.push(handler)
        return
      }
      if (!listenerMap.has(event)) listenerMap.set(event, new Set())
      listenerMap.get(event)!.add(handler)
    },

    off(event: string, handler: (...args: any[]) => void) {
      if (event === 'connect_error') {
        const idx = connectErrorHandlers.indexOf(handler)
        if (idx >= 0) connectErrorHandlers.splice(idx, 1)
        return
      }
      listenerMap.get(event)?.delete(handler)
    },
  }

  activeBus = bus

  return proxy
}

export function emit<T = any>(event: string, data?: unknown): Promise<T> {
  const sk = get(socketStore)
  if (!sk) return Promise.reject(new Error('Socket no conectado'))
  return new Promise((resolve, reject) => {
    sk.emit(event, data, (res: any) => {
      if (res?.ok || (res && res.error === undefined)) resolve(res as T)
      else reject(new Error(res?.error || 'Error del servidor'))
    })
  })
}
