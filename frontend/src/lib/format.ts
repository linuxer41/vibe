import * as flatbuffers from 'flatbuffers';

export const FORMAT_JSON = 'json';
export const FORMAT_FLATBUFFERS = 'flatbuffers';

export type WireFormat = 'json' | 'flatbuffers';

export function detectFormat(auth: Record<string, unknown> = {}): WireFormat {
  const f = (auth.format as string) || 'json';
  return f === 'flatbuffers' || f === 'fb' ? FORMAT_FLATBUFFERS : FORMAT_JSON;
}

// SocketPayload table: event(string), data([ubyte])
const SP_VT_EVENT = 4;
const SP_VT_DATA = 6;

function buildSocketPayload(builder: flatbuffers.Builder, event: string, dataBytes: Uint8Array): number {
  builder.startObject(2);
  const eventOff = builder.createString(event);
  builder.addFieldOffset(SP_VT_EVENT, eventOff, 0);
  const dataOff = builder.createByteVector(dataBytes);
  builder.addFieldOffset(SP_VT_DATA, dataOff, 0);
  return builder.endObject();
}

function parseSocketPayload(buf: ArrayBuffer): { event: string | null; data: string | null } {
  const bb = new flatbuffers.ByteBuffer(new Uint8Array(buf));
  const root = bb.readInt32(bb.position()) + bb.position();
  const eventOff = bb.__offset(root, SP_VT_EVENT);
  const event = eventOff ? bb.__string(root + eventOff) : null;
  const dataOff = bb.__offset(root, SP_VT_DATA);
  let data: string | null = null;
  if (dataOff) {
    const vecOff = root + dataOff;
    const len = bb.readInt32(vecOff);
    const raw = new Uint8Array(bb.bytes().buffer, vecOff + 4, len);
    data = new TextDecoder().decode(raw);
  }
  return { event, data };
}

export function encodeEvent(event: string, data: unknown, format: WireFormat): string | ArrayBuffer {
  if (format === FORMAT_FLATBUFFERS) {
    const fb = new flatbuffers.Builder(1024);
    const dataStr = JSON.stringify(data);
    const dataBytes = new TextEncoder().encode(dataStr);
    const payload = buildSocketPayload(fb, event, dataBytes);
    fb.finish(payload);
    return fb.asUint8Array().buffer as ArrayBuffer;
  }
  return JSON.stringify({ event, data });
}

export function decodeEvent(buf: string | ArrayBuffer): { event: string; data: unknown } {
  if (typeof buf === 'string') {
    try {
      const parsed = JSON.parse(buf);
      return { event: parsed.event || '', data: parsed.data ?? null };
    } catch {
      return { event: '', data: null };
    }
  }
  try {
    const { event: ev, data: dataStr } = parseSocketPayload(buf);
    if (ev && dataStr) {
      return { event: ev, data: JSON.parse(dataStr) };
    }
  } catch { /* fall through */ }
  return { event: '', data: null };
}
