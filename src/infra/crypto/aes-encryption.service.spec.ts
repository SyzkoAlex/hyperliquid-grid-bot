import { describe, it, expect, beforeEach } from 'vitest';
import { AesEncryptionService } from './aes-encryption.service';

const VALID_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes
const OTHER_KEY = 'b'.repeat(64);

describe('AesEncryptionService', () => {
    let sut: AesEncryptionService;

    beforeEach(() => {
        sut = new AesEncryptionService(VALID_KEY);
    });

    describe('constructor', () => {
        it('should throw when key length is not 32 bytes (64 hex chars)', () => {
            expect(() => new AesEncryptionService('deadbeef')).toThrow(
                'Encryption key must be 32 bytes',
            );
        });

        it('should throw when key contains non-hex characters', () => {
            expect(() => new AesEncryptionService('g'.repeat(64))).toThrow();
        });

        it('should construct successfully with a valid 64-char hex key', () => {
            expect(() => new AesEncryptionService(VALID_KEY)).not.toThrow();
        });
    });

    describe('encrypt / decrypt round-trip', () => {
        it('should return the original plaintext after encrypt → decrypt', () => {
            const plaintext = 'my-secret-private-key-0x1234';
            const ciphertext = sut.encrypt(plaintext);
            expect(sut.decrypt(ciphertext)).toBe(plaintext);
        });

        it('should produce different ciphertexts for the same plaintext on each call (random IV)', () => {
            const plaintext = 'same-input';
            const ct1 = sut.encrypt(plaintext);
            const ct2 = sut.encrypt(plaintext);
            expect(ct1).not.toBe(ct2);
        });

        it('should handle empty string', () => {
            const ct = sut.encrypt('');
            expect(sut.decrypt(ct)).toBe('');
        });
    });

    describe('decrypt with wrong key', () => {
        it('should throw when decrypting with a different key', () => {
            const ciphertext = sut.encrypt('secret');
            const other = new AesEncryptionService(OTHER_KEY);
            expect(() => other.decrypt(ciphertext)).toThrow();
        });
    });

    describe('decrypt with tampered ciphertext', () => {
        it('should throw when auth tag is tampered (GCM integrity check fails)', () => {
            const ciphertext = sut.encrypt('secret');
            const parts = ciphertext.split(':');
            // Flip one hex char in the auth tag
            parts[1] = parts[1].slice(0, -1) + (parts[1].endsWith('0') ? '1' : '0');
            expect(() => sut.decrypt(parts.join(':'))).toThrow();
        });

        it('should throw when ciphertext has wrong format (not 3 colon-delimited parts)', () => {
            expect(() => sut.decrypt('invalid-format')).toThrow('Invalid ciphertext format');
        });

        it('should throw when IV is wrong length', () => {
            // Build a ciphertext with a short IV
            const parts = sut.encrypt('data').split(':');
            parts[0] = 'aabb'; // only 2 bytes instead of 12
            expect(() => sut.decrypt(parts.join(':'))).toThrow('Invalid IV length');
        });
    });
});
