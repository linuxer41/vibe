export type MessageHandler = (data: ArrayBuffer) => void
export type CloseHandler = (code: number, reason: string) => void
export type ErrorHandler = (error: Error) => void

export interface Transport {
  send(data: ArrayBuffer): void
  onMessage(handler: MessageHandler): void
  onClose(handler: CloseHandler): void
  onError(handler: ErrorHandler): void
  close(): void
  get isConnected(): boolean
}
