import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecuteSpotSwapUseCase } from './execute-spot-swap.use-case';
import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';
import { Price } from '@domain/models/primitives/price';
import { ExchangePort } from '@components/trading/core/application/ports/exchange.port';
import { SpotSwapExecutorService } from '@components/trading/core/application/services/spot-swap-executor/spot-swap-executor.service';

const MIN_ORDER_NOTIONAL = 10;

describe('ExecuteSpotSwapUseCase', () => {
    let sut: ExecuteSpotSwapUseCase;
    let mockExchange: { getCurrentPrice: ReturnType<typeof vi.fn> };
    let mockExecutor: { execute: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockExchange = {
            getCurrentPrice: vi.fn().mockResolvedValue(Price.from(20)),
        };

        mockExecutor = {
            execute: vi.fn().mockResolvedValue({
                success: true,
                filledBase: 5,
                notionalUsdc: 100,
            }),
        };

        sut = new ExecuteSpotSwapUseCase(
            mockExchange as unknown as ExchangePort,
            mockExecutor as unknown as SpotSwapExecutorService,
        );
    });

    describe('execute', () => {
        it('returns failure when amountUsdc is below minOrderNotional', async () => {
            const result = await sut.execute(
                {
                    symbol: 'HYPE',
                    side: SwapSide.UsdcToBase,
                    amountUsdc: 5, // below MIN_ORDER_NOTIONAL = 10
                    accountAddress: '0xabc',
                },
                MIN_ORDER_NOTIONAL,
            );

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain('minimum order notional');
            expect(mockExecutor.execute).not.toHaveBeenCalled();
        });

        it('re-fetches current mid price before delegating to executor', async () => {
            await sut.execute(
                {
                    symbol: 'HYPE',
                    side: SwapSide.UsdcToBase,
                    amountUsdc: 100,
                    accountAddress: '0xabc',
                },
                MIN_ORDER_NOTIONAL,
            );

            expect(mockExchange.getCurrentPrice).toHaveBeenCalledOnce();
        });

        it('passes USDC amount directly to executor for UsdcToBase side', async () => {
            await sut.execute(
                {
                    symbol: 'HYPE',
                    side: SwapSide.UsdcToBase,
                    amountUsdc: 200,
                    accountAddress: '0xabc',
                },
                MIN_ORDER_NOTIONAL,
            );

            const callParams = mockExecutor.execute.mock.calls[0][0];
            expect(callParams.side).toBe(SwapSide.UsdcToBase);
            // amount should equal amountUsdc = 200 (USDC to spend)
            expect(callParams.amount.toNumber()).toBe(200);
        });

        it('converts USDC notional to base amount for BaseToUsdc side', async () => {
            // mid = 20, amountUsdc = 100 → baseAmount = 100 / 20 = 5
            await sut.execute(
                {
                    symbol: 'HYPE',
                    side: SwapSide.BaseToUsdc,
                    amountUsdc: 100,
                    accountAddress: '0xabc',
                },
                MIN_ORDER_NOTIONAL,
            );

            const callParams = mockExecutor.execute.mock.calls[0][0];
            expect(callParams.side).toBe(SwapSide.BaseToUsdc);
            expect(callParams.amount.toNumber()).toBeCloseTo(5);
        });

        it('passes the re-fetched mid to executor as currentMid', async () => {
            mockExchange.getCurrentPrice.mockResolvedValue(Price.from(25));

            await sut.execute(
                {
                    symbol: 'HYPE',
                    side: SwapSide.UsdcToBase,
                    amountUsdc: 100,
                    accountAddress: '0xabc',
                },
                MIN_ORDER_NOTIONAL,
            );

            const callParams = mockExecutor.execute.mock.calls[0][0];
            expect(callParams.currentMid).toBe(25);
        });

        it('returns executor result on success', async () => {
            const result = await sut.execute(
                {
                    symbol: 'HYPE',
                    side: SwapSide.UsdcToBase,
                    amountUsdc: 100,
                    accountAddress: '0xabc',
                },
                MIN_ORDER_NOTIONAL,
            );

            expect(result.success).toBe(true);
            expect(result.filledBase).toBe(5);
            expect(result.notionalUsdc).toBe(100);
        });

        it('returns executor result on failure', async () => {
            mockExecutor.execute.mockResolvedValue({
                success: false,
                filledBase: 0,
                notionalUsdc: 0,
                errorMessage: 'Both attempts failed',
            });

            const result = await sut.execute(
                {
                    symbol: 'HYPE',
                    side: SwapSide.UsdcToBase,
                    amountUsdc: 100,
                    accountAddress: '0xabc',
                },
                MIN_ORDER_NOTIONAL,
            );

            expect(result.success).toBe(false);
            expect(result.errorMessage).toBe('Both attempts failed');
        });

        it('passes symbol and accountAddress to executor', async () => {
            await sut.execute(
                {
                    symbol: 'HYPE',
                    side: SwapSide.UsdcToBase,
                    amountUsdc: 50,
                    accountAddress: '0xdef',
                },
                MIN_ORDER_NOTIONAL,
            );

            const callParams = mockExecutor.execute.mock.calls[0][0];
            expect(callParams.symbol).toBe('HYPE');
            expect(callParams.accountAddress).toBe('0xdef');
        });

        it('accepts amountUsdc equal to minOrderNotional (boundary)', async () => {
            const result = await sut.execute(
                {
                    symbol: 'HYPE',
                    side: SwapSide.UsdcToBase,
                    amountUsdc: MIN_ORDER_NOTIONAL, // exactly at boundary
                    accountAddress: '0xabc',
                },
                MIN_ORDER_NOTIONAL,
            );

            expect(mockExecutor.execute).toHaveBeenCalledOnce();
            expect(result.success).toBe(true);
        });

        it('propagates rejection when getCurrentPrice rejects', async () => {
            mockExchange.getCurrentPrice.mockRejectedValue(new Error('Price feed unavailable'));

            await expect(
                sut.execute(
                    {
                        symbol: 'HYPE',
                        side: SwapSide.UsdcToBase,
                        amountUsdc: 100,
                        accountAddress: '0xabc',
                    },
                    MIN_ORDER_NOTIONAL,
                ),
            ).rejects.toThrow('Price feed unavailable');

            expect(mockExecutor.execute).not.toHaveBeenCalled();
        });
    });
});
