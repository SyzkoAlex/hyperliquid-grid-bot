import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpotSwapExecutorService } from './spot-swap-executor.service';
import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';
import { OrderStatus } from '@domain/models/order/order-status';
import { Decimal } from '@domain/models/primitives/decimal';
import { Price } from '@domain/models/primitives/price';
import { ExchangePort } from '@components/trading/core/application/ports/exchange.port';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { L2Touch } from '@components/trading/core/domain/models/swap/l2-touch';

const INITIAL_L2_BUFFER = 0.001;
const RETRY_L2_BUFFER = 0.005;
const BEST_BID = 19.99;
const BEST_ASK = 20.01;

describe('SpotSwapExecutorService', () => {
    let sut: SpotSwapExecutorService;
    let mockExchange: {
        placeSpotMarketBuy: ReturnType<typeof vi.fn>;
        placeSpotMarketSell: ReturnType<typeof vi.fn>;
    };
    let mockConfig: { get: ReturnType<typeof vi.fn> };

    const baseParamsBuy = {
        symbol: 'HYPE',
        side: SwapSide.UsdcToBase,
        amount: Decimal.from(200), // 200 USDC to spend
        l2Touch: L2Touch.from(Price.from(BEST_BID), Price.from(BEST_ASK)),
        accountAddress: '0xabc',
    };

    const baseParamsSell = {
        symbol: 'HYPE',
        side: SwapSide.BaseToUsdc,
        amount: Decimal.from(5), // 5 HYPE to sell
        l2Touch: L2Touch.from(Price.from(BEST_BID), Price.from(BEST_ASK)),
        accountAddress: '0xabc',
    };

    beforeEach(() => {
        // Default mocks simulate a full fill at the limit price — filledSize
        // matches the requested base amount so existing assertions stay valid.
        const buyLimitPrice = BEST_ASK * (1 + INITIAL_L2_BUFFER);
        const defaultBuyFilledSize = 200 / buyLimitPrice; // baseAmount = usdc / limitPrice

        const sellLimitPrice = BEST_BID * (1 - INITIAL_L2_BUFFER);

        mockExchange = {
            placeSpotMarketBuy: vi.fn().mockResolvedValue({
                exchangeOrderId: 'ex-buy',
                status: OrderStatus.Filled,
                filledSize: defaultBuyFilledSize,
                avgPrice: buyLimitPrice,
            }),
            placeSpotMarketSell: vi.fn().mockResolvedValue({
                exchangeOrderId: 'ex-sell',
                status: OrderStatus.Filled,
                filledSize: 5, // matches baseParamsSell.amount
                avgPrice: sellLimitPrice,
            }),
        };

        mockConfig = {
            get: vi.fn((key: string) => {
                if (key === 'swap') {
                    return {
                        initialL2BufferPct: INITIAL_L2_BUFFER,
                        retryL2BufferPct: RETRY_L2_BUFFER,
                    };
                }
                return undefined;
            }),
        };

        sut = new SpotSwapExecutorService(
            mockExchange as unknown as ExchangePort,
            mockConfig as unknown as ConfigService<Config, true>,
        );
    });

    describe('execute — UsdcToBase side', () => {
        it('calls placeSpotMarketBuy (not sell) for UsdcToBase', async () => {
            await sut.execute(baseParamsBuy);

            expect(mockExchange.placeSpotMarketBuy).toHaveBeenCalledOnce();
            expect(mockExchange.placeSpotMarketSell).not.toHaveBeenCalled();
        });

        it('returns success result when IOC buy fills on first attempt', async () => {
            const result = await sut.execute(baseParamsBuy);

            expect(result.success).toBe(true);
            expect(result.filledBase).toBeGreaterThan(0);
            expect(result.notionalUsdc).toBeGreaterThan(0);
        });

        it('uses 0.1% L2 buffer on first attempt and 0.5% on retry for buy', async () => {
            mockExchange.placeSpotMarketBuy
                .mockResolvedValueOnce({ exchangeOrderId: 'ex-1', status: OrderStatus.Placed })
                .mockResolvedValueOnce({
                    exchangeOrderId: 'ex-2',
                    status: OrderStatus.Filled,
                    filledSize: 5,
                    avgPrice: 20,
                });

            await sut.execute(baseParamsBuy);

            const firstLimitPrice =
                mockExchange.placeSpotMarketBuy.mock.calls[0][0].limitPrice.toNumber();
            const secondLimitPrice =
                mockExchange.placeSpotMarketBuy.mock.calls[1][0].limitPrice.toNumber();

            expect(firstLimitPrice).toBeCloseTo(BEST_ASK * (1 + INITIAL_L2_BUFFER));
            expect(secondLimitPrice).toBeCloseTo(BEST_ASK * (1 + RETRY_L2_BUFFER));
        });

        it('uses same CLOID for both IOC buy attempts', async () => {
            mockExchange.placeSpotMarketBuy
                .mockResolvedValueOnce({ exchangeOrderId: 'ex-1', status: OrderStatus.Placed })
                .mockResolvedValueOnce({
                    exchangeOrderId: 'ex-2',
                    status: OrderStatus.Filled,
                    filledSize: 5,
                    avgPrice: 20,
                });

            await sut.execute(baseParamsBuy);

            const firstCloid = mockExchange.placeSpotMarketBuy.mock.calls[0][0].orderId;
            const secondCloid = mockExchange.placeSpotMarketBuy.mock.calls[1][0].orderId;
            expect(firstCloid).toBe(secondCloid);
        });

        it('retries with wider buffer when first buy attempt is not filled', async () => {
            mockExchange.placeSpotMarketBuy
                .mockResolvedValueOnce({ exchangeOrderId: 'ex-1', status: OrderStatus.Placed })
                .mockResolvedValueOnce({
                    exchangeOrderId: 'ex-2',
                    status: OrderStatus.Filled,
                    filledSize: 5,
                    avgPrice: 20,
                });

            const result = await sut.execute(baseParamsBuy);

            expect(result.success).toBe(true);
            expect(mockExchange.placeSpotMarketBuy).toHaveBeenCalledTimes(2);
        });

        it('returns failure when both buy attempts fail to fill', async () => {
            mockExchange.placeSpotMarketBuy.mockResolvedValue({
                exchangeOrderId: 'ex-1',
                status: OrderStatus.Placed,
            });

            const result = await sut.execute(baseParamsBuy);

            expect(result.success).toBe(false);
            expect(result.filledBase).toBe(0);
            expect(result.notionalUsdc).toBe(0);
            expect(result.errorMessage).toBeDefined();
            expect(mockExchange.placeSpotMarketBuy).toHaveBeenCalledTimes(2);
        });

        it('computes baseAmount as spentUsdc / limitPrice', async () => {
            await sut.execute(baseParamsBuy);

            const callParams = mockExchange.placeSpotMarketBuy.mock.calls[0][0];
            const limitPrice = callParams.limitPrice.toNumber();
            const expectedBase = 200 / limitPrice;
            expect(callParams.amount.toNumber()).toBeCloseTo(expectedBase);
        });

        it('places buy order with correct symbol and account address', async () => {
            await sut.execute(baseParamsBuy);

            const callParams = mockExchange.placeSpotMarketBuy.mock.calls[0][0];
            expect(callParams.symbol.toString()).toBe('HYPE');
            expect(callParams.accountAddress).toBe('0xabc');
        });
    });

    describe('execute — BaseToUsdc side', () => {
        it('calls placeSpotMarketSell (not buy) for BaseToUsdc', async () => {
            await sut.execute(baseParamsSell);

            expect(mockExchange.placeSpotMarketSell).toHaveBeenCalledOnce();
            expect(mockExchange.placeSpotMarketBuy).not.toHaveBeenCalled();
        });

        it('returns success result when IOC sell fills on first attempt', async () => {
            const result = await sut.execute(baseParamsSell);

            expect(result.success).toBe(true);
            expect(result.filledBase).toBeGreaterThan(0);
            expect(result.notionalUsdc).toBeGreaterThan(0);
        });

        it('uses 0.1% L2 buffer on first attempt and 0.5% on retry for sell', async () => {
            mockExchange.placeSpotMarketSell
                .mockResolvedValueOnce({ exchangeOrderId: 'ex-1', status: OrderStatus.Placed })
                .mockResolvedValueOnce({
                    exchangeOrderId: 'ex-2',
                    status: OrderStatus.Filled,
                    filledSize: 5,
                    avgPrice: 20,
                });

            await sut.execute(baseParamsSell);

            const firstLimitPrice =
                mockExchange.placeSpotMarketSell.mock.calls[0][0].limitPrice.toNumber();
            const secondLimitPrice =
                mockExchange.placeSpotMarketSell.mock.calls[1][0].limitPrice.toNumber();

            expect(firstLimitPrice).toBeCloseTo(BEST_BID * (1 - INITIAL_L2_BUFFER));
            expect(secondLimitPrice).toBeCloseTo(BEST_BID * (1 - RETRY_L2_BUFFER));
        });

        it('uses same CLOID for both IOC sell attempts', async () => {
            mockExchange.placeSpotMarketSell
                .mockResolvedValueOnce({ exchangeOrderId: 'ex-1', status: OrderStatus.Placed })
                .mockResolvedValueOnce({
                    exchangeOrderId: 'ex-2',
                    status: OrderStatus.Filled,
                    filledSize: 5,
                    avgPrice: 20,
                });

            await sut.execute(baseParamsSell);

            const firstCloid = mockExchange.placeSpotMarketSell.mock.calls[0][0].orderId;
            const secondCloid = mockExchange.placeSpotMarketSell.mock.calls[1][0].orderId;
            expect(firstCloid).toBe(secondCloid);
        });

        it('returns failure when both sell attempts fail to fill', async () => {
            mockExchange.placeSpotMarketSell.mockResolvedValue({
                exchangeOrderId: 'ex-1',
                status: OrderStatus.Placed,
            });

            const result = await sut.execute(baseParamsSell);

            expect(result.success).toBe(false);
            expect(result.filledBase).toBe(0);
            expect(result.notionalUsdc).toBe(0);
            expect(result.errorMessage).toBeDefined();
        });

        it('computes notionalUsdc as amount * limitPrice for sell', async () => {
            const result = await sut.execute(baseParamsSell);

            const expectedLimitPrice = BEST_BID * (1 - INITIAL_L2_BUFFER);
            expect(result.notionalUsdc).toBeCloseTo(5 * expectedLimitPrice);
        });

        it('treats OrderStatus.Failed sell response as not-filled, triggers retry', async () => {
            mockExchange.placeSpotMarketSell
                .mockResolvedValueOnce({ exchangeOrderId: '', status: OrderStatus.Failed })
                .mockResolvedValueOnce({
                    exchangeOrderId: 'ex-2',
                    status: OrderStatus.Filled,
                    filledSize: 5,
                    avgPrice: 20,
                });

            const result = await sut.execute(baseParamsSell);

            expect(result.success).toBe(true);
            expect(mockExchange.placeSpotMarketSell).toHaveBeenCalledTimes(2);
        });
    });

    describe('execute — OrderStatus.Failed handling', () => {
        it('treats OrderStatus.Failed buy response as not-filled, triggers retry', async () => {
            mockExchange.placeSpotMarketBuy
                .mockResolvedValueOnce({ exchangeOrderId: '', status: OrderStatus.Failed })
                .mockResolvedValueOnce({
                    exchangeOrderId: 'ex-2',
                    status: OrderStatus.Filled,
                    filledSize: 5,
                    avgPrice: 20,
                });

            const result = await sut.execute(baseParamsBuy);

            expect(result.success).toBe(true);
            expect(mockExchange.placeSpotMarketBuy).toHaveBeenCalledTimes(2);
        });

        it('returns failure when both attempts return Failed for buy', async () => {
            mockExchange.placeSpotMarketBuy.mockResolvedValue({
                exchangeOrderId: '',
                status: OrderStatus.Failed,
            });

            const result = await sut.execute(baseParamsBuy);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toBeDefined();
        });

        it('returns failure when both attempts return Failed for sell', async () => {
            mockExchange.placeSpotMarketSell.mockResolvedValue({
                exchangeOrderId: '',
                status: OrderStatus.Failed,
            });

            const result = await sut.execute(baseParamsSell);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toBeDefined();
        });
    });

    describe('execute — partial / zero fill handling', () => {
        it('returns actual filledBase and notionalUsdc from exchange for buy', async () => {
            const partialFilledSize = 6.36;
            const partialAvgPrice = 53.609;
            mockExchange.placeSpotMarketBuy.mockResolvedValueOnce({
                exchangeOrderId: 'ex-partial',
                status: OrderStatus.Filled,
                filledSize: partialFilledSize,
                avgPrice: partialAvgPrice,
            });

            const result = await sut.execute(baseParamsBuy);

            expect(result.success).toBe(true);
            expect(result.filledBase).toBeCloseTo(partialFilledSize);
            expect(result.notionalUsdc).toBeCloseTo(partialFilledSize * partialAvgPrice);
        });

        it('returns actual filledBase and notionalUsdc from exchange for sell', async () => {
            const partialFilledSize = 2.5;
            const partialAvgPrice = 19.88;
            mockExchange.placeSpotMarketSell.mockResolvedValueOnce({
                exchangeOrderId: 'ex-partial',
                status: OrderStatus.Filled,
                filledSize: partialFilledSize,
                avgPrice: partialAvgPrice,
            });

            const result = await sut.execute(baseParamsSell);

            expect(result.success).toBe(true);
            expect(result.filledBase).toBeCloseTo(partialFilledSize);
            expect(result.notionalUsdc).toBeCloseTo(partialFilledSize * partialAvgPrice);
        });

        it('treats zero filledSize as not-filled and retries for buy', async () => {
            mockExchange.placeSpotMarketBuy
                .mockResolvedValueOnce({
                    exchangeOrderId: 'ex-1',
                    status: OrderStatus.Filled,
                    filledSize: 0,
                    avgPrice: 0,
                })
                .mockResolvedValueOnce({
                    exchangeOrderId: 'ex-2',
                    status: OrderStatus.Filled,
                    filledSize: 9.985,
                    avgPrice: 20.03,
                });

            const result = await sut.execute(baseParamsBuy);

            expect(result.success).toBe(true);
            expect(mockExchange.placeSpotMarketBuy).toHaveBeenCalledTimes(2);
        });

        it('treats zero filledSize as not-filled and retries for sell', async () => {
            mockExchange.placeSpotMarketSell
                .mockResolvedValueOnce({
                    exchangeOrderId: 'ex-1',
                    status: OrderStatus.Filled,
                    filledSize: 0,
                    avgPrice: 0,
                })
                .mockResolvedValueOnce({
                    exchangeOrderId: 'ex-2',
                    status: OrderStatus.Filled,
                    filledSize: 5,
                    avgPrice: 19.97,
                });

            const result = await sut.execute(baseParamsSell);

            expect(result.success).toBe(true);
            expect(mockExchange.placeSpotMarketSell).toHaveBeenCalledTimes(2);
        });

        it('returns failure when both buy attempts return zero filledSize', async () => {
            mockExchange.placeSpotMarketBuy.mockResolvedValue({
                exchangeOrderId: 'ex-1',
                status: OrderStatus.Filled,
                filledSize: 0,
                avgPrice: 0,
            });

            const result = await sut.execute(baseParamsBuy);

            expect(result.success).toBe(false);
            expect(result.filledBase).toBe(0);
            expect(result.errorMessage).toBeDefined();
            expect(mockExchange.placeSpotMarketBuy).toHaveBeenCalledTimes(2);
        });

        it('returns failure when both sell attempts return zero filledSize', async () => {
            mockExchange.placeSpotMarketSell.mockResolvedValue({
                exchangeOrderId: 'ex-1',
                status: OrderStatus.Filled,
                filledSize: 0,
                avgPrice: 0,
            });

            const result = await sut.execute(baseParamsSell);

            expect(result.success).toBe(false);
            expect(result.filledBase).toBe(0);
            expect(result.errorMessage).toBeDefined();
            expect(mockExchange.placeSpotMarketSell).toHaveBeenCalledTimes(2);
        });
    });
});
