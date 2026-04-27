import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentKeyAdapter } from './agent-key.adapter';

const VALID_KEY = 'deadbeef'.repeat(8); // 64 hex chars

function makeConfigService(encryptionKey: string | undefined): unknown {
    return {
        get: vi.fn().mockReturnValue({ agentKeyEncryptionKey: encryptionKey }),
    };
}

describe('AgentKeyAdapter', () => {
    let adapter: AgentKeyAdapter;

    beforeEach(() => {
        adapter = new AgentKeyAdapter(makeConfigService(VALID_KEY) as any);
    });

    describe('constructor', () => {
        it('should throw when agentKeyEncryptionKey is absent', () => {
            expect(() => new AgentKeyAdapter(makeConfigService(undefined) as any)).toThrow(
                'AGENT_KEY_ENCRYPTION_KEY is required',
            );
        });

        it('should construct successfully with a valid key', () => {
            expect(() => new AgentKeyAdapter(makeConfigService(VALID_KEY) as any)).not.toThrow();
        });
    });

    describe('generateKeyPair', () => {
        it('should return an address starting with 0x followed by 40 hex chars', () => {
            const { address } = adapter.generateKeyPair();
            expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
        });

        it('should return a privateKey that is a 32-byte hex string (66 chars with 0x prefix)', () => {
            const { privateKey } = adapter.generateKeyPair();
            expect(privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/);
        });

        it('should generate unique key pairs on each call', () => {
            const kp1 = adapter.generateKeyPair();
            const kp2 = adapter.generateKeyPair();
            expect(kp1.privateKey).not.toBe(kp2.privateKey);
            expect(kp1.address).not.toBe(kp2.address);
        });
    });

    describe('encryptPrivateKey / decryptPrivateKey round-trip', () => {
        it('should decrypt to the original private key', () => {
            const privateKey = '0x' + 'ab'.repeat(32);
            const encrypted = adapter.encryptPrivateKey(privateKey);
            expect(adapter.decryptPrivateKey(encrypted)).toBe(privateKey);
        });

        it('should propagate errors from the underlying encryption service', () => {
            expect(() => adapter.decryptPrivateKey('not-valid')).toThrow();
        });
    });
});
