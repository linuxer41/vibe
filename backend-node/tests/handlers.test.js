const { sanitize } = require('../server.js');

describe('sanitize', () => {
  test('strips HTML tags', () => {
    expect(sanitize('<script>alert(1)</script>hello')).toBe('hello');
  });
  test('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });
  test('returns empty for non-string', () => {
    expect(sanitize(null)).toBe('');
    expect(sanitize(undefined)).toBe('');
    expect(sanitize(123)).toBe('');
  });
  test('returns limited length', () => {
    const long = 'a'.repeat(5000);
    expect(sanitize(long).length).toBe(2000);
  });
});

describe('Pool healthcheck', () => {
  const { healthcheck } = require('../db/pool');
  test('healthcheck returns boolean', async () => {
    const result = await healthcheck();
    expect(typeof result).toBe('boolean');
  });
});

describe('Snowflake', () => {
  const snowflake = require('../lib/snowflake');
  test('generates unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) ids.add(snowflake.generate());
    expect(ids.size).toBe(1000);
  });
  test('IDs are within safe integer range', () => {
    for (let i = 0; i < 100; i++) {
      const id = snowflake.generate();
      expect(id).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
      expect(id).toBeGreaterThan(0);
    }
  });
  test('extract returns object with timestamp, node, seq', () => {
    const id = snowflake.generate();
    const info = snowflake.extract(id);
    expect(info).toHaveProperty('timestamp');
    expect(info).toHaveProperty('node');
    expect(info).toHaveProperty('seq');
  });
});
