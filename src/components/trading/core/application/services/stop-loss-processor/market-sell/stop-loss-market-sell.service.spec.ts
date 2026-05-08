import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StopLossMarketSellService } from './stop-loss-market-sell.service';
import { OrderStatus } from '@domain/models/order/order-status';
import { Decimal } from '@domain/models/primitives/decimal';

const INITIAL_SLIPPAGE_CAP = 0.01;
const RETRY_SLIPPAGE_CAP = 0.02;

describe('StopLossMarketSellService', () => {
    let sut: StopLossMarketSellService;
    let mockExchange: {
        placeSpotMarketSell: ReturnType<typeof vi.fn>;
    };
    let mockConfig: { get: ReturnType<typeof vi.fn> };

    const baseParams = {
        gridId: 'grid-1',
        symbol: 'ETH',
        amount: Decimal.from(0.5),
        currentMid: 1880,
        accountAddress: '0xabc',
    };

    beforeEach(() => {
        mockExchange = {
            placeSpotMarketSell: vi
                .fn()
                .mockResolvedValue({ exchangeOrderId: 'ex-sl', status: OrderStatus.Filled }),
        };

        mockConfig = {
            get: vi.fn((key: string) => {
                if (key === 'stopLoss') {
                    return {
                        initialSlippageCapPct: INITIAL_SLIPPAGE_CAP,
                        retrySlippageCapPct: RETRY_SLIPPAGE_CAP,
                        confirmDurationMs: 30_000,
                        penetrationPct: 0.002,
                        breachTtlSeconds: 300,
                    };
                }
                return undefined;
            }),
        };

        sut = new StopLossMarketSellService(mockExchange as any, mockConfig as any);
    });

    describe('execute', () => {
        it('returns success result when IOC sell fills on first attempt', async () => {
            const result = await sut.execute(baseParams);

            expect(result.success).toBe(true);
            expect(result.soldBaseAmount).toBe(0.5);
            expect(result.receivedUSDC).toBeGreaterThan(0);
            expect(mockExchange.placeSpotMarketSell).toHaveBeenCalledOnce();
        });

        it('uses 1% slippage cap on first attempt and 2% on retry', async () => {
            mockExchange.placeSpotMarketSell
                .mockResolvedValueOnce({ exchangeOrderId: 'ex-1', status: OrderStatus.Placed })
                .mockResolvedValueOnce({ exchangeOrderId: 'ex-2', status: OrderStatus.Filled });

            await sut.execute(baseParams);

            const firstLimitPrice =
                mockExchange.placeSpotMarketSell.mock.calls[0][0].limitPrice.toNumber();
            const secondLimitPrice =
                mockExchange.placeSpotMarketSell.mock.calls[1][0].limitPrice.toNumber();

            // 1% cap: 1880 * (1 - 0.01) = 1861.2
            expect(firstLimitPrice).toBeCloseTo(1880 * (1 - INITIAL_SLIPPAGE_CAP));
            // 2% cap: 1880 * (1 - 0.02) = 1842.4
            expect(secondLimitPrice).toBeCloseTo(1880 * (1 - RETRY_SLIPPAGE_CAP));
        });

        it('retries with wider slippage cap when first IOC attempt is not filled', async () => {
            mockExchange.placeSpotMarketSell
                .mockResolvedValueOnce({ exchangeOrderId: 'ex-1', status: OrderStatus.Placed })
                .mockResolvedValueOnce({ exchangeOrderId: 'ex-2', status: OrderStatus.Filled });

            const result = await sut.execute(baseParams);

            expect(result.success).toBe(true);
            expect(mockExchange.placeSpotMarketSell).toHaveBeenCalledTimes(2);
        });

        it('uses same CLOID for both IOC attempts', async () => {
            mockExchange.placeSpotMarketSell
                .mockResolvedValueOnce({ exchangeOrderId: 'ex-1', status: OrderStatus.Placed })
                .mockResolvedValueOnce({ exchangeOrderId: 'ex-2', status: OrderStatus.Filled });

            await sut.execute(baseParams);

            const firstCloid = mockExchange.placeSpotMarketSell.mock.calls[0][0].orderId;
            const secondCloid = mockExchange.placeSpotMarketSell.mock.calls[1][0].orderId;
            expect(firstCloid).toBe(secondCloid);
        });

        it('returns failure when both IOC attempts fail to fill', async () => {
            mockExchange.placeSpotMarketSell.mockResolvedValue({
                exchangeOrderId: 'ex-1',
                status: OrderStatus.Placed,
            });

            const result = await sut.execute(baseParams);

            expect(result.success).toBe(false);
            expect(result.soldBaseAmount).toBe(0);
            expect(result.receivedUSDC).toBe(0);
            expect(result.errorMessage).toBeDefined();
            expect(mockExchange.placeSpotMarketSell).toHaveBeenCalledTimes(2);
        });

        it('computes receivedUSDC as amount * limitPrice', async () => {
            const result = await sut.execute(baseParams);

            // limitPrice = 1880 * (1 - 0.01) = 1861.2
            const expectedLimitPrice = 1880 * (1 - INITIAL_SLIPPAGE_CAP);
            expect(result.receivedUSDC).toBeCloseTo(0.5 * expectedLimitPrice);
        });

        it('places order with the correct symbol and account address', async () => {
            await sut.execute(baseParams);

            const callParams = mockExchange.placeSpotMarketSell.mock.calls[0][0];
            expect(callParams.symbol.toString()).toBe('ETH');
            expect(callParams.accountAddress).toBe('0xabc');
        });

        it('places order with the correct amount', async () => {
            await sut.execute(baseParams);

            const callParams = mockExchange.placeSpotMarketSell.mock.calls[0][0];
            expect(callParams.amount.toNumber()).toBe(0.5);
        });
    });
});
