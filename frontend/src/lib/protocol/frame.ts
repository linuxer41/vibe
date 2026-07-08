import { MessageType } from '../fb/vibe/message-type'
import { Flags } from './flags'

export const HEADER_SIZE = 14
export const MAGIC = 0xEB01

export interface FrameHeader {
  magic: number
  type: MessageType
  flags: number
  streamId: number
  payloadLength: number
}

export interface Frame extends FrameHeader {
  payload: ArrayBuffer
}

export function encodeFrame(
  type: MessageType,
  flags: number,
  streamId: number,
  payload?: ArrayBuffer | Uint8Array
): ArrayBuffer {
  const payloadLen = payload?.byteLength || 0
  const buf = new ArrayBuffer(HEADER_SIZE + payloadLen)
  const view = new DataView(buf)

  view.setUint16(0, MAGIC, false)
  view.setUint16(2, type, false)
  view.setUint16(4, flags, false)
  view.setUint32(6, streamId, false)
  view.setUint32(10, payloadLen, false)

  if (payload) {
    const src = payload instanceof Uint8Array ? payload : new Uint8Array(payload)
    new Uint8Array(buf, HEADER_SIZE).set(src)
  }

  return buf
}

export function encodeResponse(frame: Frame, payload?: ArrayBuffer | Uint8Array): ArrayBuffer {
  return encodeFrame(frame.type, Flags.RESPONSE, frame.streamId, payload)
}

export function encodeError(frame: Frame, errorMsg: string): ArrayBuffer {
  const errBuf = new TextEncoder().encode(errorMsg)
  return encodeFrame(frame.type, Flags.RESPONSE | Flags.ERROR, frame.streamId, errBuf)
}

export function decodeFrame(buffer: ArrayBuffer): Frame | null {
  if (buffer.byteLength < HEADER_SIZE) return null
  const view = new DataView(buffer)

  const magic = view.getUint16(0, false)
  if (magic !== MAGIC) return null

  return {
    magic,
    type: view.getUint16(2, false) as MessageType,
    flags: view.getUint16(4, false),
    streamId: view.getUint32(6, false),
    payloadLength: view.getUint32(10, false),
    payload: buffer.byteLength > HEADER_SIZE
      ? buffer.slice(HEADER_SIZE)
      : new ArrayBuffer(0),
  }
}

export function createPingFrame(): ArrayBuffer {
  return encodeFrame(MessageType.Ping, Flags.NONE, 0)
}

export function createPongFrame(): ArrayBuffer {
  return encodeFrame(MessageType.Pong, Flags.NONE, 0)
}
