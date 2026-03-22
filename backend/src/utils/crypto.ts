import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto';
import { config } from '../config';
import { prisma } from '../db/client';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;      // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;     // 128-bit auth tag (GCM default)
const RE_ENCRYPT_BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

/**
 * Returns the 32-byte current encryption key from validated config.
 * The key format is already validated by the Zod schema at startup.
 */
function getEncryptionKey(): Buffer {
  return Buffer.from(config.ENCRYPTION_KEY, 'hex');
}

/**
 * Returns the previous encryption key buffer, or null if not configured.
 * Used as a fallback during key rotation so data encrypted with the old key
 * can still be decrypted.
 */
function getPreviousEncryptionKey(): Buffer | null {
  const hexKey = config.ENCRYPTION_KEY_PREVIOUS;

  if (!hexKey) {
    return null;
  }

  return Buffer.from(hexKey, 'hex');
}

/**
 * Low-level decrypt using a specific key buffer.
 * Throws on auth tag mismatch or malformed ciphertext.
 */
function decryptWithKey(ciphertext: string, key: Buffer): string {
  const packed = Buffer.from(ciphertext, 'base64');

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

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
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
 * Always uses the current (primary) encryption key.
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
 * Tries the current key first. If decryption fails and a previous key is
 * configured (ENCRYPTION_KEY_PREVIOUS), retries with the previous key.
 * This enables transparent key rotation -- callers do not need to know
 * which key was used to encrypt the data.
 *
 * @param ciphertext - The base64-encoded string from `encrypt()`.
 * @returns The original plaintext string.
 * @throws If the ciphertext is malformed or both keys fail verification.
 */
export function decrypt(ciphertext: string): string {
  if (typeof ciphertext !== 'string') {
    throw new TypeError('decrypt() requires a string argument');
  }

  const currentKey = getEncryptionKey();

  try {
    return decryptWithKey(ciphertext, currentKey);
  } catch (primaryError) {
    // If the current key failed, try the previous key as fallback
    const previousKey = getPreviousEncryptionKey();

    if (!previousKey) {
      // No previous key configured; throw the original error
      throw new Error(
        'decrypt() failed: authentication tag verification failed. ' +
          'The data may have been tampered with or the key is wrong.'
      );
    }

    try {
      return decryptWithKey(ciphertext, previousKey);
    } catch {
      // Both keys failed; throw the original error for the current key
      throw new Error(
        'decrypt() failed: authentication tag verification failed. ' +
          'The data may have been tampered with or the key is wrong.'
      );
    }
  }
}

/**
 * Re-encrypts a ciphertext value with the current encryption key.
 * Decrypts using whichever key works (current or previous), then
 * encrypts the plaintext with the current key.
 *
 * @param ciphertext - The base64-encoded encrypted value.
 * @returns Newly encrypted value using the current key.
 */
export function reEncrypt(ciphertext: string): string {
  const plaintext = decrypt(ciphertext);
  return encrypt(plaintext);
}

/**
 * Re-encrypts all OAuth tokens in the SocialConnection table with the
 * current encryption key. This should be called after rotating keys to
 * ensure all stored tokens are encrypted with the new key.
 *
 * Processes records in batches of 50 to avoid excessive memory usage.
 *
 * @returns The count of records that were re-encrypted.
 */
export async function reEncryptAllTokens(): Promise<number> {
  let reEncryptedCount = 0;
  let cursor: string | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const connections = await prisma.socialConnection.findMany({
      take: RE_ENCRYPT_BATCH_SIZE,
      ...(cursor
        ? { skip: 1, cursor: { id: cursor } }
        : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        accessToken: true,
        refreshToken: true,
      },
    });

    if (connections.length === 0) {
      break;
    }

    for (const connection of connections) {
      try {
        const newAccessToken = reEncrypt(connection.accessToken);
        const newRefreshToken = connection.refreshToken
          ? reEncrypt(connection.refreshToken)
          : null;

        await prisma.socialConnection.update({
          where: { id: connection.id },
          data: {
            accessToken: newAccessToken,
            ...(newRefreshToken !== null
              ? { refreshToken: newRefreshToken }
              : {}),
          },
        });

        reEncryptedCount++;
      } catch (err) {
        logger.error('Failed to re-encrypt tokens for SocialConnection', {
          connectionId: connection.id,
          error: err instanceof Error ? err.message : String(err),
        });
        throw new Error(
          `Re-encryption failed for SocialConnection ${connection.id}: ` +
            (err instanceof Error ? err.message : String(err))
        );
      }
    }

    cursor = connections[connections.length - 1]!.id;

    // If we got fewer than the batch size, we've reached the end
    if (connections.length < RE_ENCRYPT_BATCH_SIZE) {
      break;
    }
  }

  logger.info('Completed re-encryption of all OAuth tokens', {
    reEncryptedCount,
  });

  return reEncryptedCount;
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
