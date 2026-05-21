import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickStartStep } from './quick-start.step';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';

describe('QuickStartStep', () => {
    let step: QuickStartStep;
    let mockTradingApi: TradingApiPort;
    let mockMessageManager: WizardMessageManager;

    beforeEach(() => {
        mockTradingApi = {
            getCurrentPrice: vi.fn(),
            getUserSpotState: vi.fn(),
            pairExists: vi.fn(),
            calculateCapitalDistribution: vi.fn().mockReturnValue({
                investmentUSDC: 500,
                investmentBase: 0.01,
                requiredBaseBalance: 0.01005,
            }),
            calculateMaxInvestment: vi.fn().mockReturnValue(5000),
        } as unknown as TradingApiPort;

        mockMessageManager = {
            sendEnterMessage: vi.fn(),
        } as unknown as WizardMessageManager;

        step = new QuickStartStep(mockTradingApi, mockMessageManager);
    });

    describe('enter', () => {
        it('should show zero base balance warning when base token is zero', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 1000,
                usdc: { available: 1000, total: 1000, hold: 0 },
                spotBalances: {},
                spotPositions: {},
            });

            await step.enter(ctx);

            const message = vi.mocked(mockMessageManager.sendEnterMessage).mock.calls[0][1];
            expect(message).toContain('You have no BTC tokens');
            expect(message).toContain('USDC: 1000');
        });

        it('should show locked-in-orders warning when all base is in orders (available = 0)', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(74);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 5697,
                usdc: { available: 5697, total: 5697, hold: 0 },
                spotBalances: { HYPE: 0 },
                spotPositions: { HYPE: { available: 0, total: 22.48, hold: 22.48 } },
            });
            vi.mocked(mockTradingApi.calculateMaxInvestment).mockReturnValue(0);

            await step.enter(ctx);

            const message = vi.mocked(mockMessageManager.sendEnterMessage).mock.calls[0][1];
            expect(message).toContain('locked in existing orders');
            expect(message).toContain('HYPE');
        });

        it('should show locked-in-orders warning when partial base is locked and max-investment is too low', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'HYPE' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(74);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 5697,
                usdc: { available: 5697, total: 5697, hold: 0 },
                spotBalances: { HYPE: 0.001 },
                spotPositions: { HYPE: { available: 0.001, total: 22.481, hold: 22.48 } },
            });
            vi.mocked(mockTradingApi.calculateMaxInvestment).mockReturnValue(0);

            await step.enter(ctx);

            const message = vi.mocked(mockMessageManager.sendEnterMessage).mock.calls[0][1];
            expect(message).toContain('locked in existing orders');
            expect(message).not.toContain('Insufficient balance');
        });

        it('should show zero USDC balance warning when USDC is zero', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 0,
                usdc: { available: 0, total: 0, hold: 0 },
                spotBalances: { BTC: 0.5 },
                spotPositions: { BTC: { available: 0.5, total: 0.5, hold: 0 } },
            });

            await step.enter(ctx);

            const message = vi.mocked(mockMessageManager.sendEnterMessage).mock.calls[0][1];
            expect(message).toContain('You have no USDC');
            expect(message).toContain('BTC: 0.5');
        });
    });

    describe('handleTextInput', () => {
        it('should calculate grid params with ±20% range and sufficient balance', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 10000,
                usdc: { available: 10000, total: 10000, hold: 0 },
                spotBalances: { BTC: 1 },
                spotPositions: { BTC: { available: 1, total: 1, hold: 0 } },
            });

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toEqual({
                nextStep: SceneStep.Preview,
                confirmations: ['✅ Investment set: 1000 USDC'],
            });
            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBe(1000);
            expect(ctx.session.createGrid?.upperPrice).toBe(60000); // 50000 + 20%
            expect(ctx.session.createGrid?.lowerPrice).toBe(40000); // 50000 - 20%
            expect(ctx.session.createGrid?.levels).toBe(10);
        });

        it('should reject investment below minimum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            const result = await step.handleTextInput(ctx, '5');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should reject invalid number', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            const result = await step.handleTextInput(ctx, 'invalid');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should handle API error gracefully', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValue(new Error('API error'));

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should return null if no symbol in session', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
        });

        it('should reject with insufficient USDC balance', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 100,
                usdc: { available: 100, total: 100, hold: 0 },
                spotBalances: { BTC: 1 },
                spotPositions: { BTC: { available: 1, total: 1, hold: 0 } },
            });
            vi.mocked(mockTradingApi.calculateCapitalDistribution).mockReturnValue({
                investmentUSDC: 500,
                investmentBase: 0.01,
                requiredBaseBalance: 0.01005,
            });

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });
    });

    describe('enter (additional paths)', () => {
        it('should show balance info when symbol exists and both balances are non-zero', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);
            vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
                usdcBalance: 5000,
                usdc: { available: 5000, total: 5000, hold: 0 },
                spotBalances: { BTC: 0.1 },
                spotPositions: { BTC: { available: 0.1, total: 0.1, hold: 0 } },
            });

            await step.enter(ctx);

            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should show fallback message when symbol is missing', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            await step.enter(ctx);

            expect(mockTradingApi.getUserSpotState).not.toHaveBeenCalled();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should show fallback message when balance fetch fails', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValue(new Error('API down'));

            await step.enter(ctx);

            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });
    });

    describe('rollbackState', () => {
        it('clears all quick-start fields', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                totalInvestmentUSDC: 1000,
                upperPrice: 60000,
                lowerPrice: 40000,
                levels: 10,
            };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBeUndefined();
            expect(ctx.session.createGrid?.upperPrice).toBeUndefined();
            expect(ctx.session.createGrid?.lowerPrice).toBeUndefined();
            expect(ctx.session.createGrid?.levels).toBeUndefined();
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
            user: { accountAddress: '0x123' },
        } as unknown as BotContext;
    }
});
