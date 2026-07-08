const flatbuffers = require('flatbuffers');

const FORMAT_JSON = 'json';
const FORMAT_FLATBUFFERS = 'flatbuffers';

function detectFormat(auth = {}) {
  const f = (auth && auth.format) || 'json';
  return f === 'flatbuffers' || f === 'fb' ? FORMAT_FLATBUFFERS : FORMAT_JSON;
}

// --- SocketPayload manual FB builder/parser ---
const SP_SCHEMA = {
  fields: [
    { name: 'event', id: 0, vt: 4 },
    { name: 'data', id: 1, vt: 6 },
  ]
};

function buildSocketPayload(builder, event, dataBytes) {
  builder.startObject(2);
  const eventOff = builder.createString(event);
  builder.addFieldOffset(SP_SCHEMA.fields[0].vt, eventOff, 0);
  const dataOff = builder.createByteVector(dataBytes);
  builder.addFieldOffset(SP_SCHEMA.fields[1].vt, dataOff, 0);
  return builder.endObject();
}

function parseSocketPayload(buf) {
  const bb = new flatbuffers.ByteBuffer(new Uint8Array(buf));
  const root = bb.readInt32(bb.position()) + bb.position();
  const event = bb.__string(root + bb.__offset(root, SP_SCHEMA.fields[0].vt));
  const dataOff = bb.__offset(root, SP_SCHEMA.fields[1].vt);
  let data = null;
  if (dataOff) {
    const vecOff = root + dataOff;
    const len = bb.readInt32(vecOff);
    const raw = Buffer.from(bb.bytes().slice(vecOff + 4, vecOff + 4 + len));
    data = raw.toString('utf-8');
  }
  return { event, data };
}

// --- ValkeyEnvelope manual FB builder/parser ---
const VE_SCHEMA = {
  fields: [
    { name: 'channel', id: 0, vt: 4 },
    { name: 'format', id: 1, vt: 6 },
    { name: 'target', id: 2, vt: 8 },
    { name: 'event', id: 3, vt: 10 },
    { name: 'data', id: 4, vt: 12 },
  ]
};

function buildValkeyEnvelope(builder, channel, format, target, event, dataBytes) {
  builder.startObject(5);
  builder.addFieldOffset(VE_SCHEMA.fields[0].vt, builder.createString(channel), 0);
  builder.addFieldOffset(VE_SCHEMA.fields[1].vt, builder.createString(format), 0);
  if (target) builder.addFieldOffset(VE_SCHEMA.fields[2].vt, builder.createString(target), 0);
  builder.addFieldOffset(VE_SCHEMA.fields[3].vt, builder.createString(event), 0);
  if (dataBytes) builder.addFieldOffset(VE_SCHEMA.fields[4].vt, builder.createByteVector(dataBytes), 0);
  return builder.endObject();
}

function parseValkeyEnvelope(buf) {
  const bb = new flatbuffers.ByteBuffer(new Uint8Array(buf));
  const root = bb.readInt32(bb.position()) + bb.position();
  const channel = bb.__string(root + bb.__offset(root, VE_SCHEMA.fields[0].vt));
  const fmt = bb.__string(root + bb.__offset(root, VE_SCHEMA.fields[1].vt));
  const targetOff = bb.__offset(root, VE_SCHEMA.fields[2].vt);
  const target = targetOff ? bb.__string(root + targetOff) : null;
  const event = bb.__string(root + bb.__offset(root, VE_SCHEMA.fields[3].vt));
  const dataOff = bb.__offset(root, VE_SCHEMA.fields[4].vt);
  let data = null;
  if (dataOff) {
    const vecOff = root + dataOff;
    const len = bb.readInt32(vecOff);
    const raw = Buffer.from(bb.bytes().slice(vecOff + 4, vecOff + 4 + len));
    data = raw.toString('utf-8');
  }
  return { channel, format: fmt, target, event, data };
}

// --- Public API ---

function encodeEvent(event, data, format = FORMAT_JSON) {
  if (format === FORMAT_FLATBUFFERS) {
    const builder = new flatbuffers.Builder(1024);
    const dataStr = JSON.stringify(data);
    const payload = buildSocketPayload(builder, event, Buffer.from(dataStr, 'utf-8'));
    builder.finish(payload);
    return Buffer.from(builder.asUint8Array());
  }
  return Buffer.from(JSON.stringify({ event, data }));
}

function decodeEvent(buf) {
  try {
    const { event, data } = parseSocketPayload(buf);
    if (event !== null && data !== null) {
      return { event, data: JSON.parse(data) };
    }
  } catch (_) { /* fall through */ }

  try {
    const parsed = JSON.parse(buf.toString());
    return { event: parsed.event || '', data: parsed.data || null };
  } catch (_) {
    return { event: '', data: null };
  }
}

function encodeValkey(channel, target, event, data, format = FORMAT_JSON) {
  if (format === FORMAT_FLATBUFFERS) {
    const builder = new flatbuffers.Builder(1024);
    const dataStr = JSON.stringify(data);
    const dataBytes = dataStr ? Buffer.from(dataStr, 'utf-8') : null;
    const payload = buildValkeyEnvelope(builder, channel, FORMAT_FLATBUFFERS, target || null, event, dataBytes);
    builder.finish(payload);
    return Buffer.from(builder.asUint8Array());
  }
  return Buffer.from(JSON.stringify({ channel, format: FORMAT_JSON, target, event, data }));
}

function decodeValkey(buf) {
  try {
    const parsed = parseValkeyEnvelope(buf);
    if (parsed.channel !== null) {
      let data = null;
      if (parsed.data) {
        try { data = JSON.parse(parsed.data); } catch (_) { data = null; }
      }
      return { channel: parsed.channel, target: parsed.target, event: parsed.event, data };
    }
  } catch (_) { /* fall through */ }

  try {
    const parsed = JSON.parse(buf.toString());
    return {
      channel: parsed.channel || '',
      target: parsed.target || null,
      event: parsed.event || '',
      data: parsed.data || null,
    };
  } catch (_) {
    return { channel: '', target: null, event: '', data: null };
  }
}

module.exports = {
  FORMAT_JSON,
  FORMAT_FLATBUFFERS,
  detectFormat,
  encodeEvent,
  decodeEvent,
  encodeValkey,
  decodeValkey,
};
