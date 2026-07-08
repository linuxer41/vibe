import type { Transport, MessageHandler, CloseHandler, ErrorHandler } from './types'

export class WsTransport implements Transport {
  private ws: WebSocket | null = null
  private msgHandler: MessageHandler | null = null
  private closeHandler: CloseHandler | null = null
  private errHandler: ErrorHandler | null = null
  private _connected = false
  private url: string
  private reconnectInterval: number
  private maxReconnects: number
  private reconnectCount = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _closing = false

  constructor(url: string, reconnectInterval = 3000, maxReconnects = 10) {
    this.url = url
    this.reconnectInterval = reconnectInterval
    this.maxReconnects = maxReconnects
  }

  connect(token?: string): void {
    this._closing = false
    const wsUrl = token ? `${this.url}?token=${token}` : this.url
    this.ws = new WebSocket(wsUrl)
    this.ws.binaryType = 'arraybuffer'

    this.ws.onopen = () => {
      this._connected = true
      this.reconnectCount = 0
    }

    this.ws.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer && this.msgHandler) {
        this.msgHandler(event.data)
      }
    }

    this.ws.onclose = (event: CloseEvent) => {
      this._connected = false
      if (this.closeHandler) this.closeHandler(event.code, event.reason)
      if (!this._closing && this.reconnectCount < this.maxReconnects) {
        this.reconnectCount++
        this.reconnectTimer = setTimeout(() => this.connect(token), this.reconnectInterval)
      }
    }

    this.ws.onerror = () => {
      if (this.errHandler) this.errHandler(new Error('WebSocket error'))
    }
  }

  send(data: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    }
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
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this._connected = false
  }

  get isConnected(): boolean {
    return this._connected && this.ws?.readyState === WebSocket.OPEN
  }
}
