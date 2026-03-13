import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedInvestmentStep } from './advanced-investment.step';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';

describe('AdvancedInvestmentStep', () => {
    let step: AdvancedInvestmentStep;
    let mockMessageManager: WizardMessageManager;
    let mockTradingApi: TradingApiPort;
    let mockConfigService: ConfigService<Config, true>;

    beforeEach(() => {
        mockMessageManager = {
            sendEnterMessage: vi.fn(),
        } as unknown as WizardMessageManager;

        mockTradingApi = {
            getCurrentPrice: vi.fn().mockResolvedValue(10),
            getUserSpotState: vi.fn().mockResolvedValue({
                usdcBalance: 10000,
                spotBalances: { HYPE: 1000 },
            }),
            pairExists: vi.fn(),
            calculateCapitalDistribution: vi.fn().mockReturnValue({
                investmentUSDC: 500,
                investmentBase: 50,
            }),
        } as unknown as TradingApiPort;

        mockConfigService = {
            get: vi.fn().mockReturnValue('0x123'),
        } as unknown as ConfigService<Config, true>;

        step = new AdvancedInvestmentStep(mockMessageManager, mockTradingApi, mockConfigService);
    });

    describe('enter', () => {
        it('should show zero base balance warning when base token is zero', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE', levels: 10 };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(10);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 5000,
                usdc: { available: 5000, total: 5000, hold: 0 },
                spotBalances: {},
                spotPositions: {},
            });

            await step.enter(ctx);

            const message = vi.mocked(mockMessageManager.sendEnterMessage).mock.calls[0][1];
            expect(message).toContain('You have no HYPE tokens');
            expect(message).toContain('USDC: 5000');
        });

        it('should show zero USDC balance warning when USDC is zero', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE', levels: 10 };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(10);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 0,
                usdc: { available: 0, total: 0, hold: 0 },
                spotBalances: { HYPE: 500 },
                spotPositions: { HYPE: { available: 500, total: 500, hold: 0 } },
            });

            await step.enter(ctx);

            const message = vi.mocked(mockMessageManager.sendEnterMessage).mock.calls[0][1];
            expect(message).toContain('You have no USDC');
            expect(message).toContain('HYPE: 500');
        });
    });

    describe('handleTextInput', () => {
        it('should accept valid investment amount with sufficient balance', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 10,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toEqual({
                nextStep: SceneStep.Preview,
                confirmations: ['✅ Investment set: 1000 USDC'],
            });
            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBe(1000);
        });

        it('should reject investment below minimum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 10,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            const result = await step.handleTextInput(ctx, '5');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should reject when per-order amount is too small', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 20,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            const result = await step.handleTextInput(ctx, '50'); // 50/20 = 2.5 < 10

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should reject when balance is insufficient', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 10,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            vi.mocked(mockTradingApi.calculateCapitalDistribution).mockReturnValue({
                investmentUSDC: 15000, // More than available balance
                investmentBase: 50,
            });

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should reject non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 10,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            const result = await step.handleTextInput(ctx, 'abc');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should return null if required state not set', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { levels: 10 }; // Missing symbol, upperPrice, lowerPrice

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
        });
    });

    describe('enter (additional paths)', () => {
        it('should show balance info when symbol exists and both balances are non-zero', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE', levels: 10 };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(10);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 5000,
                usdc: { available: 5000, total: 5000, hold: 0 },
                spotBalances: { HYPE: 500 },
                spotPositions: { HYPE: { available: 500, total: 500, hold: 0 } },
            });

            await step.enter(ctx);

            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should show fallback message when symbol is missing', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { levels: 10 };

            await step.enter(ctx);

            expect(mockTradingApi.getUserSpotState).not.toHaveBeenCalled();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should show fallback message when balance fetch fails', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE', levels: 10 };
            vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValue(new Error('API down'));

            await step.enter(ctx);

            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });
    });

    describe('handleTextInput (additional paths)', () => {
        it('should handle validateInvestment throwing an error', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 10,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };
            vi.mocked(mockTradingApi.getUserSpotState).mockRejectedValue(
                new Error('Network error'),
            );

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });
    });

    describe('rollbackState', () => {
        it('deletes totalInvestmentUSDC from session', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { totalInvestmentUSDC: 1000 };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBeUndefined();
        });

        it('does nothing when createGrid is undefined', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            expect(() => step.rollbackState(ctx)).not.toThrow();
        });
    });

    function createMockContext(): BotContext {
        const session = { createGrid: {} };
        return {
            session,
            scene: { leave: vi.fn() },
        } as unknown as BotContext;
    }
});
