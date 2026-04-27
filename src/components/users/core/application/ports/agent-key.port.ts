export const AGENT_KEY_PORT = Symbol('AGENT_KEY_PORT');

export interface AgentKeyPort {
    generateKeyPair(): { privateKey: string; address: string };
    encryptPrivateKey(privateKey: string): string;
    decryptPrivateKey(encrypted: string): string;
}
