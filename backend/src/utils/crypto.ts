import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;      // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;     // 128-bit auth tag (GCM default)

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

/**
 * Derives the 32-byte encryption key from the ENCRYPTION_KEY env var.
 * Accepts the raw 64-char hex string specified in config.
 */
function getEncryptionKey(): Buffer {
  const hexKey = process.env['ENCRYPTION_KEY'];

  if (!hexKey) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
        'Generate one with: openssl rand -hex 32'
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
        'Generate one with: openssl rand -hex 32'
    );
  }

  return Buffer.from(hexKey, 'hex');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * The output is a base64-encoded string with the following layout:
 *   [ IV (12 bytes) | Auth Tag (16 bytes) | Ciphertext (n bytes) ]
 *
 * @param plaintext - The string to encrypt (e.g., an OAuth access token).
 * @returns Base64-encoded ciphertext with embedded IV and auth tag.
 */
export function encrypt(plaintext: string): string {
  if (typeof plaintext !== 'string') {
    throw new TypeError('encrypt() requires a string argument');
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Pack: iv (12) + tag (16) + ciphertext (n)
  const packed = Buffer.concat([iv, authTag, encrypted]);

  return packed.toString('base64');
}

/**
 * Decrypts a base64-encoded string produced by `encrypt()`.
 *
 * @param ciphertext - The base64-encoded string from `encrypt()`.
 * @returns The original plaintext string.
 * @throws If the ciphertext is malformed or the auth tag fails verification.
 */
export function decrypt(ciphertext: string): string {
  if (typeof ciphertext !== 'string') {
    throw new TypeError('decrypt() requires a string argument');
  }

  const key = getEncryptionKey();
  const packed = Buffer.from(ciphertext, 'base64');

  // Minimum valid packed size: IV (12) + Auth Tag (16) = 28 bytes.
  // Zero-byte plaintext produces zero-byte ciphertext, so packed.length == 28 is valid.
  if (packed.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error(
      'decrypt() failed: ciphertext is too short to be valid'
    );
  }

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = packed.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (err) {
    throw new Error(
      'decrypt() failed: authentication tag verification failed. ' +
        'The data may have been tampered with or the key is wrong.'
    );
  }
}

/**
 * Produces a deterministic SHA-256 hash of the input (hex-encoded).
 * Useful for creating lookup tokens from OAuth state parameters etc.
 * NOT suitable for password hashing — use bcryptjs for that.
 *
 * @param input - The string to hash.
 * @returns 64-character hex string.
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Generates a cryptographically random hex token of the given byte length.
 * Default 32 bytes → 64 hex chars.
 *
 * @param byteLength - Number of random bytes (default: 32).
 * @returns Hex-encoded random token.
 */
export function generateSecureToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('hex');
}
