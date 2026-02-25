import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelectPairStep } from './select-pair.step';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';

describe('SelectPairStep', () => {
    let step: SelectPairStep;
    let mockTradingApi: TradingApiPort;
    let mockMessageManager: WizardMessageManager;

    beforeEach(() => {
        mockTradingApi = {
            pairExists: vi.fn(),
            getCurrentPrice: vi.fn(),
            getUserSpotState: vi.fn(),
        } as unknown as TradingApiPort;

        mockMessageManager = {
            sendEnterMessage: vi.fn(),
        } as unknown as WizardMessageManager;

        step = new SelectPairStep(mockTradingApi, mockMessageManager);
    });

    describe('handlePairSelection', () => {
        it('should accept valid symbol and set in session', async () => {
            const ctx = createMockContext();
            vi.mocked(mockTradingApi.pairExists).mockResolvedValue(true);

            const result = await step.handlePairSelection(ctx, 'BTC');

            expect(result).toEqual({
                nextStep: SceneStep.Mode,
                confirmations: ['✅ Selected: BTC/USDC'],
            });
            expect(ctx.session.createGrid).toEqual({ symbol: 'BTC' });
            expect(mockTradingApi.pairExists).toHaveBeenCalledWith('BTC');
        });

        it('should accept HYPE token and set in session', async () => {
            const ctx = createMockContext();
            vi.mocked(mockTradingApi.pairExists).mockResolvedValue(true);

            const result = await step.handlePairSelection(ctx, 'HYPE');

            expect(result).toEqual({
                nextStep: SceneStep.Mode,
                confirmations: ['✅ Selected: HYPE/USDC'],
            });
            expect(ctx.session.createGrid).toEqual(expect.objectContaining({ symbol: 'HYPE' }));
            expect(mockTradingApi.pairExists).toHaveBeenCalledWith('HYPE');
        });

        it('should reject invalid symbol', async () => {
            const ctx = createMockContext();
            vi.mocked(mockTradingApi.pairExists).mockResolvedValue(false);

            const result = await step.handlePairSelection(ctx, 'INVALID');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should handle TradingSymbol creation error', async () => {
            const ctx = createMockContext();
            vi.mocked(mockTradingApi.pairExists).mockRejectedValue(new Error('Invalid symbol'));

            const result = await step.handlePairSelection(ctx, '');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should handle empty symbol string', async () => {
            const ctx = createMockContext();
            vi.mocked(mockTradingApi.pairExists).mockResolvedValue(false);

            const result = await step.handlePairSelection(ctx, '');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });
    });

    describe('handleTextInput', () => {
        it('should convert text to uppercase and validate', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};
            vi.mocked(mockTradingApi.pairExists).mockResolvedValue(true);

            const result = await step.handleTextInput(ctx, 'btc');

            expect(result).toEqual({
                nextStep: SceneStep.Mode,
                confirmations: ['✅ Selected: BTC/USDC'],
            });
            expect(ctx.session.createGrid?.symbol).toBe('BTC');
        });

        it('should return null if session not initialized', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            const result = await step.handleTextInput(ctx, 'BTC');

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
