import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * AES-256-GCM encryption service.
 * Output format: iv:authTag:ciphertext (all hex-encoded).
 */
export class AesEncryptionService {
    private readonly key: Buffer;

    constructor(encryptionKeyHex: string) {
        const key = Buffer.from(encryptionKeyHex, 'hex');
        if (key.length !== 32) {
            throw new Error('Encryption key must be 32 bytes (64 hex characters)');
        }
        this.key = key;
    }

    encrypt(plaintext: string): string {
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, this.key, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
    }

    decrypt(ciphertext: string): string {
        const parts = ciphertext.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid ciphertext format');
        }
        const [ivHex, authTagHex, encryptedHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const encrypted = Buffer.from(encryptedHex, 'hex');

        if (iv.length !== IV_LENGTH) {
            throw new Error('Invalid IV length');
        }
        if (authTag.length !== AUTH_TAG_LENGTH) {
            throw new Error('Invalid auth tag length');
        }

        const decipher = createDecipheriv(ALGORITHM, this.key, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    }
}
