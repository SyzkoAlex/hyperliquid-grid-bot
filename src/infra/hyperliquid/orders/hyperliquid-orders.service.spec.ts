import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HyperliquidOrdersService } from './hyperliquid-orders.service';
import { Tif } from './wire/tif';
import { Grouping } from './wire/grouping';

// Deterministic test private key (not a real key used anywhere)
const TEST_AGENT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

function makeMockHttp() {
    return {
        postExchange: vi.fn(),
        postInfo: vi.fn(),
    };
}

function makeMockMeta(overrides?: Partial<{ szDecimals: number; assetIndex: number }>) {
    return {
        getSzDecimals: vi.fn().mockReturnValue(overrides?.szDecimals ?? 2),
        getSpotAssetIndex: vi.fn().mockReturnValue(overrides?.assetIndex ?? 10),
        lookupSpotKey: vi.fn().mockReturnValue('@10'),
        resolveSpotSymbol: vi.fn(),
        pairExists: vi.fn(),
        onModuleInit: vi.fn(),
    };
}

describe('HyperliquidOrdersService', () => {
    let http: ReturnType<typeof makeMockHttp>;
    let meta: ReturnType<typeof makeMockMeta>;
    let sut: HyperliquidOrdersService;

    beforeEach(() => {
        http = makeMockHttp();
        meta = makeMockMeta();
        sut = new HyperliquidOrdersService(http as never, meta as never, false);
    });

    describe('placeSpotOrder', () => {
        it('should floor size for buy orders', async () => {
            meta.getSzDecimals.mockReturnValue(2);
            http.postExchange.mockResolvedValue({ status: 'ok' });

            await sut.placeSpotOrder({
                symbol: 'HYPE',
                isBuy: true,
                amount: 1.999,
                price: 10.0,
                agentPrivateKey: TEST_AGENT_PRIVATE_KEY,
            });

            const call = http.postExchange.mock.calls[0][0] as {
                action: { orders: { s: string }[] };
            };
            // floor(1.999, 2) = 1.99
            expect(call.action.orders[0].s).toBe('1.99');
        });

        it('should ceil size for sell orders', async () => {
            meta.getSzDecimals.mockReturnValue(2);
            http.postExchange.mockResolvedValue({ status: 'ok' });

            await sut.placeSpotOrder({
                symbol: 'HYPE',
                isBuy: false,
                amount: 1.001,
                price: 10.0,
                agentPrivateKey: TEST_AGENT_PRIVATE_KEY,
            });

            const call = http.postExchange.mock.calls[0][0] as {
                action: { orders: { s: string }[] };
            };
            // ceil(1.001, 2) = 1.01
            expect(call.action.orders[0].s).toBe('1.01');
        });

        it('should call postExchange once with correct asset index from meta', async () => {
            meta.getSpotAssetIndex.mockReturnValue(42);
            http.postExchange.mockResolvedValue({ status: 'ok' });

            await sut.placeSpotOrder({
                symbol: 'HYPE',
                isBuy: true,
                amount: 1.0,
                price: 10.0,
                agentPrivateKey: TEST_AGENT_PRIVATE_KEY,
            });

            expect(http.postExchange).toHaveBeenCalledOnce();
            const call = http.postExchange.mock.calls[0][0] as {
                action: { orders: { a: number }[] };
            };
            expect(call.action.orders[0].a).toBe(42);
        });

        it('should produce action with correct order key order a,b,p,s,r,t without cloid', async () => {
            http.postExchange.mockResolvedValue({ status: 'ok' });

            await sut.placeSpotOrder({
                symbol: 'HYPE',
                isBuy: true,
                amount: 1.0,
                price: 10.0,
                agentPrivateKey: TEST_AGENT_PRIVATE_KEY,
            });

            const call = http.postExchange.mock.calls[0][0] as { action: { orders: object[] } };
            expect(Object.keys(call.action.orders[0])).toEqual(['a', 'b', 'p', 's', 'r', 't']);
        });

        it('should include c key last when cloid supplied', async () => {
            http.postExchange.mockResolvedValue({ status: 'ok' });

            await sut.placeSpotOrder({
                symbol: 'HYPE',
                isBuy: true,
                amount: 1.0,
                price: 10.0,
                cloid: '0xdeadbeef',
                agentPrivateKey: TEST_AGENT_PRIVATE_KEY,
            });

            const call = http.postExchange.mock.calls[0][0] as { action: { orders: object[] } };
            expect(Object.keys(call.action.orders[0])).toEqual(['a', 'b', 'p', 's', 'r', 't', 'c']);
        });

        it('should produce action with type order and grouping na', async () => {
            http.postExchange.mockResolvedValue({ status: 'ok' });

            await sut.placeSpotOrder({
                symbol: 'HYPE',
                isBuy: true,
                amount: 1.0,
                price: 10.0,
                agentPrivateKey: TEST_AGENT_PRIVATE_KEY,
            });

            const call = http.postExchange.mock.calls[0][0] as {
                action: { type: string; grouping: string };
            };
            expect(call.action.type).toBe('order');
            expect(call.action.grouping).toBe(Grouping.Na);
        });

        it('should include a signature with r, s, v fields', async () => {
            http.postExchange.mockResolvedValue({ status: 'ok' });

            await sut.placeSpotOrder({
                symbol: 'HYPE',
                isBuy: true,
                amount: 1.0,
                price: 10.0,
                agentPrivateKey: TEST_AGENT_PRIVATE_KEY,
            });

            const call = http.postExchange.mock.calls[0][0] as {
                signature: { r: string; s: string; v: number };
            };
            expect(call.signature).toMatchObject({
                r: expect.stringMatching(/^0x/),
                s: expect.stringMatching(/^0x/),
                v: expect.any(Number),
            });
        });

        it('should use default Gtc tif in order wire', async () => {
            http.postExchange.mockResolvedValue({ status: 'ok' });

            await sut.placeSpotOrder({
                symbol: 'HYPE',
                isBuy: true,
                amount: 1.0,
                price: 10.0,
                agentPrivateKey: TEST_AGENT_PRIVATE_KEY,
            });

            const call = http.postExchange.mock.calls[0][0] as {
                action: { orders: { t: { limit: { tif: string } } }[] };
            };
            expect(call.action.orders[0].t.limit.tif).toBe(Tif.Gtc);
        });
    });

    describe('cancelSpotOrder', () => {
        it('should post cancel action with correct type and cancels array', async () => {
            meta.getSpotAssetIndex.mockReturnValue(7);
            http.postExchange.mockResolvedValue({ status: 'ok' });

            await sut.cancelSpotOrder({
                symbol: 'HYPE',
                exchangeOrderId: 123456,
                agentPrivateKey: TEST_AGENT_PRIVATE_KEY,
            });

            expect(http.postExchange).toHaveBeenCalledOnce();
            const call = http.postExchange.mock.calls[0][0] as {
                action: { type: string; cancels: { a: number; o: number }[] };
            };
            expect(call.action.type).toBe('cancel');
            expect(call.action.cancels).toEqual([{ a: 7, o: 123456 }]);
        });

        it('should include signature in cancel request', async () => {
            http.postExchange.mockResolvedValue({ status: 'ok' });

            await sut.cancelSpotOrder({
                symbol: 'HYPE',
                exchangeOrderId: 999,
                agentPrivateKey: TEST_AGENT_PRIVATE_KEY,
            });

            const call = http.postExchange.mock.calls[0][0] as {
                signature: { r: string; s: string; v: number };
            };
            expect(call.signature).toMatchObject({
                r: expect.stringMatching(/^0x/),
                s: expect.stringMatching(/^0x/),
                v: expect.any(Number),
            });
        });

        it('should pass vaultAddress as null', async () => {
            http.postExchange.mockResolvedValue({ status: 'ok' });

            await sut.cancelSpotOrder({
                symbol: 'HYPE',
                exchangeOrderId: 1,
                agentPrivateKey: TEST_AGENT_PRIVATE_KEY,
            });

            const call = http.postExchange.mock.calls[0][0] as { vaultAddress: null };
            expect(call.vaultAddress).toBeNull();
        });
    });
});
