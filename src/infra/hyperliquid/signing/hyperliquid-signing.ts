import { encode } from '@msgpack/msgpack';
import { hexToBytes, keccak256, parseSignature } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import { normalizeTrailingZeros } from './hyperliquid-action-normalizer';

/**
 * Hyperliquid L1 Action Signing
 *
 * All trading actions on Hyperliquid are signed as EIP-712 typed data messages.
 * The flow is:
 *   1. Serialize the action with MessagePack → append nonce + vault flag → keccak256 → `connectionId`
 *   2. Wrap `connectionId` in a phantom "Agent" struct and sign it with EIP-712
 *
 * Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing
 * Reference SDK (Python): https://github.com/hyperliquid-dex/hyperliquid-python-sdk/blob/master/hyperliquid/utils/signing.py
 */

/**
 * Phantom EIP-712 domain used for ALL L1 action signatures.
 *
 * chainId 1337 is a deliberate "phantom" value — Hyperliquid is not an EVM chain,
 * so there is no real chain. The value 1337 is hardcoded in the exchange protocol
 * to distinguish HL signatures from any real EVM network.
 *
 * verifyingContract is the zero address for the same reason — there is no on-chain
 * contract to verify against; the exchange validator checks signatures off-chain.
 */
const phantomDomain = {
    name: 'Exchange',
    version: '1',
    chainId: 1337,
    verifyingContract: '0x0000000000000000000000000000000000000000' as const,
} as const;

/**
 * EIP-712 type definition for the Agent struct.
 *
 * `source` distinguishes mainnet ('a') from testnet ('b') — prevents replay attacks
 * across environments while reusing the same signing key.
 * `connectionId` is the keccak256 hash of the encoded action + nonce (+ vault address).
 */
const agentTypes = {
    Agent: [
        { name: 'source', type: 'string' },
        { name: 'connectionId', type: 'bytes32' },
    ],
} as const;

export interface HlSignature {
    r: string;
    s: string;
    v: number;
}

/**
 * Builds the `connectionId` hash that uniquely identifies a signed action.
 *
 * Binary layout of the buffer passed to keccak256:
 *
 *   [ msgpack(action) ][ nonce: 8 bytes, big-endian uint64 ][ vaultFlag: 1 byte ][ vaultAddress?: 20 bytes ]
 *
 * vaultFlag = 0x00  → no vault, total extra = 8 + 1 = 9 bytes
 * vaultFlag = 0x01  → vault present, total extra = 8 + 1 + 20 = 29 bytes
 *
 * `nonce` is the action timestamp in milliseconds (unix ms). It prevents replay attacks
 * and must be monotonically increasing per account.
 *
 * Refs:
 *   https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing
 *   https://github.com/hyperliquid-dex/hyperliquid-python-sdk/blob/master/hyperliquid/utils/signing.py#L55
 */
function actionHash(action: unknown, vaultAddress: string | null, nonce: number): `0x${string}` {
    const normalizedAction = normalizeTrailingZeros(action);
    const msgPackBytes = encode(normalizedAction);

    // 9 bytes = 8 (nonce) + 1 (vaultFlag=0x00)
    // 29 bytes = 8 (nonce) + 1 (vaultFlag=0x01) + 20 (vault Ethereum address)
    const extra = vaultAddress === null ? 9 : 29;
    const data = new Uint8Array(msgPackBytes.length + extra);
    data.set(msgPackBytes);

    const view = new DataView(data.buffer);
    // Nonce: 8 bytes, big-endian (false = big-endian in DataView API)
    view.setBigUint64(msgPackBytes.length, BigInt(nonce), false);

    if (vaultAddress === null) {
        view.setUint8(msgPackBytes.length + 8, 0); // vaultFlag = 0x00
    } else {
        view.setUint8(msgPackBytes.length + 8, 1); // vaultFlag = 0x01
        data.set(hexToBytes(vaultAddress as `0x${string}`), msgPackBytes.length + 9);
    }

    return keccak256(data);
}

/**
 * Signs a Hyperliquid L1 action using EIP-712.
 *
 * Steps:
 *   1. Hash the action into `connectionId` via `actionHash`.
 *   2. Build a phantom Agent struct: `{ source, connectionId }`.
 *      - source = 'a' on mainnet, 'b' on testnet (replay protection between environments).
 *   3. Sign the Agent struct with EIP-712 using the phantom domain (chainId 1337).
 *   4. Return split signature { r, s, v } expected by the Hyperliquid REST API.
 *
 * Refs:
 *   https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint#placing-an-order
 *   https://github.com/hyperliquid-dex/hyperliquid-python-sdk/blob/master/hyperliquid/utils/signing.py#L70
 */
export async function signL1Action(
    account: PrivateKeyAccount,
    action: unknown,
    nonce: number,
    isMainnet: boolean,
): Promise<HlSignature> {
    const hash = actionHash(action, null, nonce);
    const phantomAgent = { source: isMainnet ? 'a' : 'b', connectionId: hash };
    const signature = await account.signTypedData({
        domain: phantomDomain,
        types: agentTypes,
        primaryType: 'Agent',
        message: phantomAgent,
    });
    const { r, s, v } = parseSignature(signature);
    return { r, s, v: Number(v) };
}
