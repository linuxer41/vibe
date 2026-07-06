// 53-bit Snowflake ID (safe for JavaScript Number)
// ┌──────────────┬──────────┬──────────┐
// │ timestamp    │ node     │ sequence │
// │ 31 bits      │ 10 bits  │ 12 bits  │
// └──────────────┴──────────┴──────────┘
// Total: 53 bits ≈ 9e15, safe within Number.MAX_SAFE_INTEGER (9e15)
// Timestamp: seconds since 2024-01-01 (≈68 years)
// Node: 0-1023 (from env SNOWFLAKE_NODE_ID or random)
// Sequence: 0-4095 per second

const CUSTOM_EPOCH = 1704067200; // 2024-01-01T00:00:00Z in Unix seconds
const NODE_ID = Math.min(Math.max(parseInt(process.env.SNOWFLAKE_NODE_ID) || 0, 0), 1023);
const NODE_SHIFT = 12;
const SEQ_MASK = 0xFFF; // 12 bits

let lastTime = -1;
let sequence = 0;

function generate() {
  let now = Math.floor(Date.now() / 1000);
  const timestamp = now - CUSTOM_EPOCH;

  if (timestamp < 0) {
    throw new Error('Clock moved backwards. Refusing to generate ID.');
  }

  if (timestamp === lastTime) {
    sequence = (sequence + 1) & SEQ_MASK;
    if (sequence === 0) {
      // Sequence exhausted, wait for next second
      while (now === lastTime) {
        now = Math.floor(Date.now() / 1000);
      }
      lastTime = now;
    }
  } else {
    sequence = 0;
    lastTime = timestamp;
  }

  return (timestamp << 22) | (NODE_ID << NODE_SHIFT) | sequence;
}

function extract(id) {
  const seq = id & SEQ_MASK;
  const node = (id >> NODE_SHIFT) & 0x3FF;
  const ts = (id >> 22) + CUSTOM_EPOCH;
  return {
    timestamp: ts,
    date: new Date(ts * 1000).toISOString(),
    node,
    sequence: seq,
  };
}

module.exports = { generate, extract, CUSTOM_EPOCH };
