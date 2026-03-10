/**
 * Unit tests for src/utils/crypto.ts
 *
 * Tests cover:
 *  - encrypt / decrypt round-trip
 *  - Ciphertext randomness (IV is random; same input → different ciphertext)
 *  - Tamper detection (auth tag verification)
 *  - sha256Hex determinism
 *  - generateSecureToken uniqueness and length
 *  - Edge cases and error conditions
 */

// Set required env before importing the module under test
process.env['ENCRYPTION_KEY'] = 'a'.repeat(64); // 32 bytes of 0xaa

import {
  encrypt,
  decrypt,
  sha256Hex,
  generateSecureToken,
} from '../../../src/utils/crypto';

// ---------------------------------------------------------------------------
// encrypt / decrypt
// ---------------------------------------------------------------------------

describe('encrypt()', () => {
  it('returns a non-empty base64 string', () => {
    const result = encrypt('hello world');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Base64url chars only
    expect(() => Buffer.from(result, 'base64')).not.toThrow();
  });

  it('produces different ciphertext for the same plaintext on each call (random IV)', () => {
    const plaintext = 'OAuth access token secret';
    const ciphertext1 = encrypt(plaintext);
    const ciphertext2 = encrypt(plaintext);
    // Same plaintext → different ciphertext due to random IV
    expect(ciphertext1).not.toBe(ciphertext2);
  });

  it('handles empty string input', () => {
    const result = encrypt('');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles long inputs (1kb)', () => {
    const longText = 'a'.repeat(1024);
    const result = encrypt(longText);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles Unicode / emoji input', () => {
    const unicodeText = '🔐 Secure token: abc123 — données confidentielles';
    const result = encrypt(unicodeText);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('throws TypeError for non-string input', () => {
    expect(() => encrypt(null as unknown as string)).toThrow(TypeError);
    expect(() => encrypt(123 as unknown as string)).toThrow(TypeError);
    expect(() => encrypt(undefined as unknown as string)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// decrypt
// ---------------------------------------------------------------------------

describe('decrypt()', () => {
  it('correctly decrypts encrypted plaintext (round-trip)', () => {
    const plaintext = 'super-secret-oauth-token-abc123';
    const ciphertext = encrypt(plaintext);
    const result = decrypt(ciphertext);
    expect(result).toBe(plaintext);
  });

  it('round-trips empty string', () => {
    const ciphertext = encrypt('');
    const result = decrypt(ciphertext);
    expect(result).toBe('');
  });

  it('round-trips long Unicode input', () => {
    const original = '日本語テスト 🎌 こんにちは世界 — test payload with special chars: <>&"';
    const ciphertext = encrypt(original);
    const result = decrypt(ciphertext);
    expect(result).toBe(original);
  });

  it('round-trips a realistic OAuth access token', () => {
    const token =
      'AQWXmZ7N8kLmP2sT9vRq4hJdEbCfKy1oUiYxW0aD5gFnHjI3eV6uA';
    const ciphertext = encrypt(token);
    const result = decrypt(ciphertext);
    expect(result).toBe(token);
  });

  it('throws for a truncated ciphertext', () => {
    // Too short to contain IV + tag + any ciphertext
    const tooShort = Buffer.from('short').toString('base64');
    expect(() => decrypt(tooShort)).toThrow();
  });

  it('throws for a tampered ciphertext (bit-flipped)', () => {
    const ciphertext = encrypt('sensitive data');
    const packed = Buffer.from(ciphertext, 'base64');

    // Flip a byte in the ciphertext portion (after IV and auth tag)
    const tampered = Buffer.from(packed);
    tampered[30] = (tampered[30]! ^ 0xff);

    const tamperedB64 = tampered.toString('base64');

    expect(() => decrypt(tamperedB64)).toThrow(
      /decrypt\(\) failed|authentication/i
    );
  });

  it('throws for a completely invalid base64 payload', () => {
    // Random garbage that looks like base64 but will fail GCM auth check
    const garbage = Buffer.alloc(40, 0x00).toString('base64');
    expect(() => decrypt(garbage)).toThrow();
  });

  it('throws TypeError for non-string input', () => {
    expect(() => decrypt(null as unknown as string)).toThrow(TypeError);
    expect(() => decrypt(42 as unknown as string)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// sha256Hex
// ---------------------------------------------------------------------------

describe('sha256Hex()', () => {
  it('returns a 64-character hex string', () => {
    const result = sha256Hex('hello');
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same input always produces same output', () => {
    const input = 'state-parameter-for-oauth';
    expect(sha256Hex(input)).toBe(sha256Hex(input));
    expect(sha256Hex(input)).toBe(sha256Hex(input));
  });

  it('produces different hashes for different inputs', () => {
    expect(sha256Hex('abc')).not.toBe(sha256Hex('ABC'));
    expect(sha256Hex('hello')).not.toBe(sha256Hex('world'));
  });

  it('matches known SHA-256 value for "hello"', () => {
    // Pre-computed: echo -n "hello" | sha256sum
    expect(sha256Hex('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    );
  });

  it('handles empty string', () => {
    // SHA-256 of empty string is well-defined
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });
});

// ---------------------------------------------------------------------------
// generateSecureToken
// ---------------------------------------------------------------------------

describe('generateSecureToken()', () => {
  it('returns a hex string of the correct length (default 32 bytes = 64 hex chars)', () => {
    const token = generateSecureToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('respects the byteLength parameter', () => {
    expect(generateSecureToken(16)).toMatch(/^[0-9a-f]{32}$/);
    expect(generateSecureToken(64)).toMatch(/^[0-9a-f]{128}$/);
  });

  it('generates unique tokens on successive calls', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateSecureToken()));
    // 50 tokens should all be unique
    expect(tokens.size).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Missing ENCRYPTION_KEY error handling
// ---------------------------------------------------------------------------

describe('Missing ENCRYPTION_KEY', () => {
  const originalKey = process.env['ENCRYPTION_KEY'];

  beforeEach(() => {
    delete process.env['ENCRYPTION_KEY'];
    // Clear module cache so the env change is picked up
    jest.resetModules();
  });

  afterEach(() => {
    process.env['ENCRYPTION_KEY'] = originalKey;
    jest.resetModules();
  });

  it('throws when ENCRYPTION_KEY is missing', () => {
    // Re-import after clearing env
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { encrypt: freshEncrypt } = require('../../../src/utils/crypto');
    expect(() => freshEncrypt('test')).toThrow(/ENCRYPTION_KEY/);
  });
});
