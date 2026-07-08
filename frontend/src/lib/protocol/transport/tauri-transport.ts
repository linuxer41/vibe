import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { Transport, MessageHandler, CloseHandler, ErrorHandler } from './types'

export class TauriTransport implements Transport {
  private msgHandler: MessageHandler | null = null
  private closeHandler: CloseHandler | null = null
  private errHandler: ErrorHandler | null = null
  private _connected = false
  private unlistenFrame: UnlistenFn | null = null
  private unlistenDisconnect: UnlistenFn | null = null
  private addr: string
  private _closing = false

  constructor(addr: string) {
    this.addr = addr
  }

  async connect(token?: string): Promise<void> {
    this._closing = false
    try {
      this.unlistenFrame = await listen<{ msg_type: number; flags: number; stream_id: number; payload: number[] }>('backend-frame', (event) => {
        if (this.msgHandler) {
          const payload = new Uint8Array(event.payload.payload).buffer as ArrayBuffer
          const header = new ArrayBuffer(14)
          const view = new DataView(header)
          view.setUint16(0, 0xEB01, false)
          view.setUint16(2, event.payload.msg_type, false)
          view.setUint16(4, event.payload.flags, false)
          view.setUint32(6, event.payload.stream_id, false)
          view.setUint32(10, payload.byteLength, false)
          const frame = new Uint8Array(14 + payload.byteLength)
          frame.set(new Uint8Array(header), 0)
          frame.set(new Uint8Array(payload), 14)
          this.msgHandler(frame.buffer as ArrayBuffer)
        }
      })
      this.unlistenDisconnect = await listen('backend-disconnected', () => {
        this._connected = false
        if (this.closeHandler && !this._closing) this.closeHandler(1006, 'disconnected')
      })
      await invoke('connect_backend', { addr: this.addr, token: token || '' })
      this._connected = true
    } catch (err: any) {
      this._connected = false
      if (this.errHandler) this.errHandler(new Error(err?.toString() || 'Tauri connect failed'))
    }
  }

  send(data: ArrayBuffer): void {
    const bytes = new Uint8Array(data)
    invoke('send_raw_frame', { raw: Array.from(bytes) }).catch((err) => {
      if (this.errHandler) this.errHandler(new Error(err?.toString() || 'send failed'))
    })
  }

  onMessage(handler: MessageHandler): void {
    this.msgHandler = handler
  }

  onClose(handler: CloseHandler): void {
    this.closeHandler = handler
  }

  onError(handler: ErrorHandler): void {
    this.errHandler = handler
  }

  close(): void {
    this._closing = true
    if (this.unlistenFrame) { this.unlistenFrame(); this.unlistenFrame = null }
    if (this.unlistenDisconnect) { this.unlistenDisconnect(); this.unlistenDisconnect = null }
    invoke('disconnect_backend').catch(() => {})
    this._connected = false
  }

  get isConnected(): boolean {
    return this._connected
  }
}
