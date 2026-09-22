/**
 * Canonical scan-derived UV-atlas encoding, shared by Node and browsers.
 * These public, normalized Z samples are not depth photographs or a fuzzy extractor.
 * schemaVersion 1: 64×64 row-major heights (numbers/null), mask (0/1),
 * and expectedSha256 (64 lowercase hexadecimal characters).
 * expectedSha256 is reference metadata, never a substitute for hashing bytes.
 */
export function sampleHeightmap(field) {
  if (!field || typeof field !== 'object' || Array.isArray(field)
      || field.schemaVersion !== 1 || field.width !== 64 || field.height !== 64
      || typeof field.expectedSha256 !== 'string'
      || !/^[0-9a-f]{64}$/.test(field.expectedSha256)
      || !Array.isArray(field.heights) || !Array.isArray(field.mask)
      || field.heights.length !== 4096 || field.mask.length !== 4096) {
    throw new TypeError('Expected schemaVersion 1, 64×64 heights/mask and a SHA256 reference');
  }
  const { width, height } = field;
  const values = new Uint16Array(width * height);
  const bytes = new Uint8Array(12 + values.length * 3);
  bytes.set([83, 86, 72, 77, 48, 48, 48, 49]); // SVHM0001
  const view = new DataView(bytes.buffer);
  view.setUint16(8, width, true);
  view.setUint16(10, height, true);
  let validCount = 0;
  for (let i = 0; i < values.length; i++) {
    const valid = field.mask[i];
    const value = field.heights[i];
    if (valid !== 0 && valid !== 1) throw new TypeError(`Invalid mask at cell ${i}`);
    if (valid === 0) {
      if (value !== null) throw new TypeError(`Invalid cells must be null at cell ${i}`);
    } else {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new TypeError(`Expected finite normalized height at cell ${i}`);
      }
      values[i] = Math.floor(value * 65535 + 0.5);
      validCount++;
    }
    bytes[12 + i * 3] = valid;
    view.setUint16(13 + i * 3, values[i], true);
  }
  return { bytes, values, validCount, width, height };
}

/** 12-byte header followed by (validity byte, uint16 LE height) per cell. */
export function encodeHeightmap(field) {
  return sampleHeightmap(field).bytes;
}
