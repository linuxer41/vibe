export class StreamManager {
  private nextId = 1
  private pending = new Map<number, { resolve: (payload: ArrayBuffer) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }>()
  private timeout: number

  constructor(timeout = 30000) {
    this.timeout = timeout
  }

  next(): number {
    const id = this.nextId++
    if (this.nextId > 0xFFFFFFFF) this.nextId = 1
    return id
  }

  wait(streamId: number): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(streamId)
        reject(new Error('Stream timeout'))
      }, this.timeout)
      this.pending.set(streamId, { resolve, reject, timer })
    })
  }

  resolve(streamId: number, payload: ArrayBuffer, isError = false): void {
    const entry = this.pending.get(streamId)
    if (!entry) return
    clearTimeout(entry.timer)
    this.pending.delete(streamId)
    if (isError) {
      const msg = new TextDecoder().decode(payload)
      entry.reject(new Error(msg))
    } else {
      entry.resolve(payload)
    }
  }

  rejectAll(err: Error): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer)
      entry.reject(err)
    }
    this.pending.clear()
  }

  get pendingCount(): number {
    return this.pending.size
  }
}
