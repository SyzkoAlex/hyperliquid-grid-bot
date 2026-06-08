import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecuteSpotSwapUseCase } from './execute-spot-swap.use-case';
import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';
import { Price } from '@domain/models/primitives/price';
import { ExchangePort } from '@components/trading/core/application/ports/exchange.port';
import { SpotSwapExecutorService } from '@components/trading/core/application/services/spot-swap-executor/spot-swap-executor.service';
import { L2Touch } from '@components/trading/core/domain/models/swap/l2-touch';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';

const MIN_ORDER_NOTIONAL = 10;

describe('ExecuteSpotSwapUseCase', () => {
    let sut: ExecuteSpotSwapUseCase;
    let mockExchange: { getL2Touch: ReturnType<typeof vi.fn> };
    let mockExecutor: { execute: ReturnType<typeof vi.fn> };
    let mockConfig: { get: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockExchange = {
            getL2Touch: vi
                .fn()
                .mockResolvedValue(L2Touch.from(Price.from(19.99), Price.from(20.01))),
        };

        mockExecutor = {
            execute: vi.fn().mockResolvedValue({
                success: true,
                filledBase: 5,
                notionalUsdc: 100,
            }),
        };

        mockConfig = {
            get: vi.fn((key: string) => {
                if (key === 'hyperliquid') return { minOrderNotional: MIN_ORDER_NOTIONAL };
                return undefined;
            }),
        };

        sut = new ExecuteSpotSwapUseCase(
            mockExchange as unknown as ExchangePort,
            mockExecutor as unknown as SpotSwapExecutorService,
            mockConfig as unknown as ConfigService<Config, true>,
        );
    });

    describe('execute', () => {
        it('returns failure when amountUsdc is below minOrderNotional', async () => {
            const result = await sut.execute({
                symbol: 'HYPE',
                side: SwapSide.UsdcToBase,
                amountUsdc: 5, // below MIN_ORDER_NOTIONAL = 10
                accountAddress: '0xabc',
            });

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain('minimum order notional');
            expect(mockExecutor.execute).not.toHaveBeenCalled();
        });

        it('fetches L2 touch before delegating to executor', async () => {
            await sut.execute({
                symbol: 'HYPE',
                side: SwapSide.UsdcToBase,
                amountUsdc: 100,
                accountAddress: '0xabc',
            });

            expect(mockExchange.getL2Touch).toHaveBeenCalledOnce();
        });

        it('passes USDC amount directly to executor for UsdcToBase side', async () => {
            await sut.execute({
                symbol: 'HYPE',
                side: SwapSide.UsdcToBase,
                amountUsdc: 200,
                accountAddress: '0xabc',
            });

            const callParams = mockExecutor.execute.mock.calls[0][0];
            expect(callParams.side).toBe(SwapSide.UsdcToBase);
            // amount should equal amountUsdc = 200 (USDC to spend)
            expect(callParams.amount.toNumber()).toBe(200);
        });

        it('converts USDC notional to base amount for BaseToUsdc side', async () => {
            // bestBid = 19.99, amountUsdc = 100 → baseAmount = 100 / 19.99
            await sut.execute({
                symbol: 'HYPE',
                side: SwapSide.BaseToUsdc,
                amountUsdc: 100,
                accountAddress: '0xabc',
            });

            const callParams = mockExecutor.execute.mock.calls[0][0];
            expect(callParams.side).toBe(SwapSide.BaseToUsdc);
            expect(callParams.amount.toNumber()).toBeCloseTo(100 / 19.99);
        });

        it('passes the L2 touch to executor', async () => {
            mockExchange.getL2Touch.mockResolvedValue(
                L2Touch.from(Price.from(24.5), Price.from(25.5)),
            );

            await sut.execute({
                symbol: 'HYPE',
                side: SwapSide.UsdcToBase,
                amountUsdc: 100,
                accountAddress: '0xabc',
            });

            const callParams = mockExecutor.execute.mock.calls[0][0];
            expect(callParams.l2Touch.bestBid.toNumber()).toBe(24.5);
            expect(callParams.l2Touch.bestAsk.toNumber()).toBe(25.5);
        });

        it('returns executor result on success', async () => {
            const result = await sut.execute({
                symbol: 'HYPE',
                side: SwapSide.UsdcToBase,
                amountUsdc: 100,
                accountAddress: '0xabc',
            });

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

            const result = await sut.execute({
                symbol: 'HYPE',
                side: SwapSide.UsdcToBase,
                amountUsdc: 100,
                accountAddress: '0xabc',
            });

            expect(result.success).toBe(false);
            expect(result.errorMessage).toBe('Both attempts failed');
        });

        it('passes symbol and accountAddress to executor', async () => {
            await sut.execute({
                symbol: 'HYPE',
                side: SwapSide.UsdcToBase,
                amountUsdc: 50,
                accountAddress: '0xdef',
            });

            const callParams = mockExecutor.execute.mock.calls[0][0];
            expect(callParams.symbol).toBe('HYPE');
            expect(callParams.accountAddress).toBe('0xdef');
        });

        it('accepts amountUsdc equal to minOrderNotional (boundary)', async () => {
            const result = await sut.execute({
                symbol: 'HYPE',
                side: SwapSide.UsdcToBase,
                amountUsdc: MIN_ORDER_NOTIONAL, // exactly at boundary
                accountAddress: '0xabc',
            });

            expect(mockExecutor.execute).toHaveBeenCalledOnce();
            expect(result.success).toBe(true);
        });

        it('propagates rejection when getL2Touch rejects', async () => {
            mockExchange.getL2Touch.mockRejectedValue(new Error('L2 unavailable'));

            await expect(
                sut.execute({
                    symbol: 'HYPE',
                    side: SwapSide.UsdcToBase,
                    amountUsdc: 100,
                    accountAddress: '0xabc',
                }),
            ).rejects.toThrow('L2 unavailable');

            expect(mockExecutor.execute).not.toHaveBeenCalled();
        });
    });
});
