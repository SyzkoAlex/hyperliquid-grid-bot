import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuickStartStep } from './quick-start.step';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BotContext } from '../../../types/bot-context';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { SceneStep } from '../create-grid-scene-step';

describe('QuickStartStep', () => {
    let step: QuickStartStep;
    let mockTradingApi: TradingApiPort;
    let mockConfigService: ConfigService<Config, true>;
    let mockMessageManager: WizardMessageManager;

    beforeEach(() => {
        mockTradingApi = {
            getCurrentPrice: vi.fn(),
            getUserSpotState: vi.fn(),
            pairExists: vi.fn(),
            calculateCapitalDistribution: vi.fn().mockReturnValue({
                investmentUSDC: 500,
                investmentBase: 0.01,
            }),
        } as unknown as TradingApiPort;

        mockConfigService = {
            get: vi.fn().mockReturnValue('0x123'),
        } as unknown as ConfigService<Config, true>;

        mockMessageManager = {
            sendEnterMessage: vi.fn(),
        } as unknown as WizardMessageManager;

        step = new QuickStartStep(mockTradingApi, mockMessageManager, mockConfigService);
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
            });

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
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
