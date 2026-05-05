import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { AesEncryptionService } from '@/infra/crypto/aes-encryption.service';
import { AgentKeyPort } from '../../../core/application/ports/agent-key.port';
import { Config } from '@/config/config.schema';

@Injectable()
export class AgentKeyAdapter implements AgentKeyPort {
    private readonly encryption: AesEncryptionService;

    constructor(private readonly configService: ConfigService<Config, true>) {
        const encryptionKey = this.configService.get('hyperliquid', {
            infer: true,
        }).agentKeyEncryptionKey;
        if (!encryptionKey) {
            throw new Error(
                'HYPERLIQUID_AGENT_KEY_ENCRYPTION_KEY is required for agent wallet functionality',
            );
        }
        this.encryption = new AesEncryptionService(encryptionKey);
    }

    generateKeyPair(): { privateKey: string; address: string } {
        const privateKey = generatePrivateKey();
        const account = privateKeyToAccount(privateKey);
        return {
            privateKey,
            address: account.address,
        };
    }

    encryptPrivateKey(privateKey: string): string {
        return this.encryption.encrypt(privateKey);
    }

    decryptPrivateKey(encrypted: string): string {
        return this.encryption.decrypt(encrypted);
    }
}
