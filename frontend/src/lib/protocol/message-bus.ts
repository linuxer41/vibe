import { decodeFrame, encodeFrame, encodeResponse, encodeError, createPingFrame, HEADER_SIZE } from './frame'
import type { Frame } from './frame'
import { Flags, hasFlag } from './flags'
import { StreamManager } from './stream'
import type { Transport } from './transport/types'

export type MessageHandler = (frame: Frame, transport: Transport) => void
export type UnsubscribeFn = () => void

export class MessageBus {
  private transport: Transport
  private handlers = new Map<number, Set<MessageHandler>>()
  private streams = new StreamManager()
  private rawHandler: ((data: ArrayBuffer) => void) | null = null
  private _pinger: ReturnType<typeof setInterval> | null = null

  constructor(transport: Transport) {
    this.transport = transport
    this.rawHandler = (data: ArrayBuffer) => this.onData(data)
    this.transport.onMessage(this.rawHandler)
  }

  private onData(data: ArrayBuffer): void {
    const frame = decodeFrame(data)
    if (!frame) return

    if (frame.type === 1) { // Ping
      this.transport.send(encodeFrame(2, Flags.NONE, frame.streamId))
      return
    }
    if (frame.type === 2) return // Pong, ignore

    if (hasFlag(frame.flags, Flags.RESPONSE)) {
      this.streams.resolve(frame.streamId, frame.payload, hasFlag(frame.flags, Flags.ERROR))
      return
    }

    const handlers = this.handlers.get(frame.type)
    if (handlers) {
      for (const h of handlers) {
        h(frame, this.transport)
      }
    }
  }

  on(type: number, handler: MessageHandler): UnsubscribeFn {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
    return () => this.handlers.get(type)?.delete(handler)
  }

  off(type: number, handler: MessageHandler): void {
    this.handlers.get(type)?.delete(handler)
  }

  async request(type: number, payload?: ArrayBuffer): Promise<ArrayBuffer> {
    const streamId = this.streams.next()
    const frame = encodeFrame(type, Flags.REQUEST, streamId, payload)
    this.transport.send(frame)
    return this.streams.wait(streamId)
  }

  send(type: number, payload?: ArrayBuffer): void {
    this.transport.send(encodeFrame(type, Flags.NONE, 0, payload))
  }

  respond(frame: Frame, payload?: ArrayBuffer): void {
    this.transport.send(encodeResponse(frame, payload))
  }

  error(frame: Frame, errorMessage: string): void {
    this.transport.send(encodeError(frame, errorMessage))
  }

  startPing(intervalMs = 30000): void {
    this.stopPing()
    this._pinger = setInterval(() => {
      this.transport.send(createPingFrame())
    }, intervalMs)
  }

  stopPing(): void {
    if (this._pinger) {
      clearInterval(this._pinger)
      this._pinger = null
    }
  }

  destroy(): void {
    this.stopPing()
    this.handlers.clear()
    this.streams.rejectAll(new Error('MessageBus destroyed'))
    if (this.rawHandler) {
      this.rawHandler = null
    }
  }
}
