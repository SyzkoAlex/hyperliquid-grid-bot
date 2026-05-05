import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HyperliquidInfoService } from './hyperliquid-info.service';
import { HyperliquidOrderStatusFound } from '../types/hyperliquid-order-status-response';

function makeMockHttp() {
    return {
        postInfo: vi.fn(),
        postExchange: vi.fn(),
    };
}

function makeHttpError(status: number): Error {
    const err = new Error(`HTTP ${status}`) as Error & { response: { status: number } };
    (err as Error & { response: { status: number } }).response = { status };
    return err;
}

describe('HyperliquidInfoService', () => {
    let http: ReturnType<typeof makeMockHttp>;
    let sut: HyperliquidInfoService;

    beforeEach(() => {
        http = makeMockHttp();
        sut = new HyperliquidInfoService(http as never);
    });

    describe('getAllMids', () => {
        it('should delegate to postInfo with type allMids', async () => {
            const mids = { 'HYPE-SPOT': '10.5' };
            http.postInfo.mockResolvedValue(mids);

            const result = await sut.getAllMids();

            expect(http.postInfo).toHaveBeenCalledWith({ type: 'allMids' });
            expect(result).toEqual(mids);
        });
    });

    describe('getOpenOrders', () => {
        it('should delegate to postInfo with type openOrders and user', async () => {
            http.postInfo.mockResolvedValue([]);
            const user = '0xabc';

            const result = await sut.getOpenOrders(user);

            expect(http.postInfo).toHaveBeenCalledWith({ type: 'openOrders', user });
            expect(result).toEqual([]);
        });
    });

    describe('getOrderStatus', () => {
        it('should return null when HTTP 422 error occurs', async () => {
            http.postInfo.mockRejectedValue(makeHttpError(422));

            const result = await sut.getOrderStatus('0xabc', 12345);

            expect(result).toBeNull();
        });

        it('should rethrow non-422 HTTP errors', async () => {
            http.postInfo.mockRejectedValue(makeHttpError(500));

            await expect(sut.getOrderStatus('0xabc', 12345)).rejects.toThrow('HTTP 500');
        });

        it('should return null when response has unknownOid status', async () => {
            http.postInfo.mockResolvedValue({ status: 'unknownOid' });

            const result = await sut.getOrderStatus('0xabc', 99999);

            expect(result).toBeNull();
        });

        it('should return null when response is falsy', async () => {
            http.postInfo.mockResolvedValue(null);

            const result = await sut.getOrderStatus('0xabc', 1);

            expect(result).toBeNull();
        });

        it('should return response when status is order', async () => {
            const found: HyperliquidOrderStatusFound = {
                status: 'order',
                order: {
                    order: {
                        coin: 'HYPE',
                        side: 'B',
                        limitPx: '10',
                        sz: '1',
                        oid: 42,
                        timestamp: 1000,
                        origSz: '1',
                    },
                    status: 'open',
                    statusTimestamp: 1000,
                },
            };
            http.postInfo.mockResolvedValue(found);

            const result = await sut.getOrderStatus('0xabc', 42);

            expect(result).toEqual(found);
        });

        it('should call postInfo with correct orderStatus payload', async () => {
            http.postInfo.mockResolvedValue({ status: 'unknownOid' });

            await sut.getOrderStatus('0xuser', 777);

            expect(http.postInfo).toHaveBeenCalledWith({
                type: 'orderStatus',
                user: '0xuser',
                oid: 777,
            });
        });
    });

    describe('getUserFills', () => {
        it('should delegate to postInfo with type userFillsByTime', async () => {
            http.postInfo.mockResolvedValue([]);

            const result = await sut.getUserFills('0xabc', 1000, 2000);

            expect(http.postInfo).toHaveBeenCalledWith({
                type: 'userFillsByTime',
                user: '0xabc',
                startTime: 1000,
                endTime: 2000,
            });
            expect(result).toEqual([]);
        });
    });

    describe('getSpotClearinghouseState', () => {
        it('should delegate to postInfo with type spotClearinghouseState', async () => {
            const state = { balances: [] };
            http.postInfo.mockResolvedValue(state);

            const result = await sut.getSpotClearinghouseState('0xabc');

            expect(http.postInfo).toHaveBeenCalledWith({
                type: 'spotClearinghouseState',
                user: '0xabc',
            });
            expect(result).toEqual(state);
        });
    });
});
