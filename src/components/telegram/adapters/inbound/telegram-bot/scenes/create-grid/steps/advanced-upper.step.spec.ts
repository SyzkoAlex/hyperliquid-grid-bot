import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedUpperStep } from './advanced-upper.step';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';

describe('AdvancedUpperStep', () => {
    let step: AdvancedUpperStep;
    let mockTradingApi: TradingApiPort;
    let mockMessageManager: WizardMessageManager;

    beforeEach(() => {
        mockTradingApi = {
            getCurrentPrice: vi.fn(),
            getUserSpotState: vi.fn(),
            pairExists: vi.fn(),
        } as unknown as TradingApiPort;

        mockMessageManager = {
            sendEnterMessage: vi.fn(),
        } as unknown as WizardMessageManager;

        step = new AdvancedUpperStep(mockTradingApi, mockMessageManager);
    });

    describe('enter', () => {
        it('should show current price if symbol exists', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);

            await step.enter(ctx);

            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should handle price fetch error gracefully', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValue(new Error('API error'));

            await step.enter(ctx);

            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });
    });

    describe('handleTextInput', () => {
        it('should accept valid upper price', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleTextInput(ctx, '55000');

            expect(result).toEqual({
                nextStep: SceneStep.Lower,
                confirmations: ['✅ Upper price set: 55000'],
            });
            expect(ctx.session.createGrid?.upperPrice).toBe(55000);
        });

        it('should reject zero or negative price', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleTextInput(ctx, '0');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should reject non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleTextInput(ctx, 'abc');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should return null if session not initialized', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            const result = await step.handleTextInput(ctx, '55000');

            expect(result).toBeNull();
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
