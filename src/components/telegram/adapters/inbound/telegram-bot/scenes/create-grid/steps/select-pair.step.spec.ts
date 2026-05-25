import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelectPairStep } from './select-pair.step';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';
import { buildPairAction } from '../create-grid-actions';

describe('SelectPairStep', () => {
    let step: SelectPairStep;
    let mockTradingApi: TradingApiPort;

    beforeEach(() => {
        mockTradingApi = {
            pairExists: vi.fn(),
            getCurrentPrice: vi.fn(),
            getUserSpotState: vi.fn(),
            getTopSymbolsByVolume: vi.fn().mockResolvedValue([
                { symbol: 'HYPE', displayName: 'HYPE' },
                { symbol: 'UBTC', displayName: 'BTC' },
                { symbol: 'UETH', displayName: 'ETH' },
                { symbol: 'USOL', displayName: 'SOL' },
            ]),
        } as unknown as TradingApiPort;

        step = new SelectPairStep(mockTradingApi);
    });

    describe('buildView', () => {
        it('returns body with PROMPT text', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            expect(view.body).toContain('Select token');
        });

        it('renders HYPE button (same-symbol, no parens)', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            const hypeRow = view.keyboard.find((r) => r[0]?.text === 'HYPE');
            expect(hypeRow).toBeDefined();
        });

        it('renders BTC (UBTC) for a token where displayName differs from symbol', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            const btcRow = view.keyboard.find((r) => r[0]?.text === 'BTC (UBTC)');
            expect(btcRow).toBeDefined();
        });

        it('uses on-chain symbol (UBTC) as callback_data for BTC button', async () => {
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            const btcRow = view.keyboard.find((r) => r[0]?.text === 'BTC (UBTC)');
            expect(btcRow![0].action).toBe(buildPairAction('UBTC'));
        });

        it('renders only Other Token and Cancel buttons when getTopSymbolsByVolume throws', async () => {
            vi.mocked(mockTradingApi.getTopSymbolsByVolume).mockRejectedValue(
                new Error('network error'),
            );
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            expect(view.keyboard).toHaveLength(2);
        });

        it('calls tradingApi.getTopSymbolsByVolume and renders all returned tokens', async () => {
            const dynamicTokens = [
                { symbol: 'TOKEN1', displayName: 'TOKEN1' },
                { symbol: 'TOKEN2', displayName: 'TOKEN2' },
                { symbol: 'TOKEN3', displayName: 'TOKEN3' },
            ];
            vi.mocked(mockTradingApi.getTopSymbolsByVolume).mockResolvedValue(dynamicTokens);
            const ctx = createMockContext();

            const view = await step.buildView(ctx);

            const tokenRows = view.keyboard.filter((row) =>
                dynamicTokens.some((t) => t.symbol === row[0]?.text),
            );
            expect(tokenRows).toHaveLength(dynamicTokens.length);
        });

        it('returns plain PROMPT body regardless of pendingError (error prepend is handled by BoardRenderer)', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { pendingError: '❌ Token not found' };

            const view = await step.buildView(ctx);

            expect(view.body).toContain('Select token');
            expect(view.body).not.toContain('❌ Token not found');
        });
    });

    describe('handleOtherPair', () => {
        it('sets OTHER_TOKEN_PROMPT as pendingError in session', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            await step.handleOtherPair(ctx);

            expect(ctx.session.createGrid.pendingError).toBeTruthy();
        });
    });

    describe('rollbackState', () => {
        it('deletes symbol from session', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.symbol).toBeUndefined();
        });

        it('does nothing when createGrid is undefined', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            expect(() => step.rollbackState(ctx)).not.toThrow();
        });
    });

    describe('handlePairSelection', () => {
        it('should accept valid symbol and set in session', async () => {
            const ctx = createMockContext();
            vi.mocked(mockTradingApi.pairExists).mockResolvedValue(true);

            const result = await step.handlePairSelection(ctx, 'BTC');

            expect(result).toEqual({ nextStep: SceneStep.Mode });
            expect(ctx.session.createGrid?.symbol).toBe('BTC');
            expect(mockTradingApi.pairExists).toHaveBeenCalledWith('BTC');
        });

        it('should reject invalid symbol by setting pendingError and returning null', async () => {
            const ctx = createMockContext();
            vi.mocked(mockTradingApi.pairExists).mockResolvedValue(false);

            const result = await step.handlePairSelection(ctx, 'INVALID');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should handle TradingApi error by setting pendingError and returning null', async () => {
            const ctx = createMockContext();
            vi.mocked(mockTradingApi.pairExists).mockRejectedValue(new Error('Invalid symbol'));

            const result = await step.handlePairSelection(ctx, '');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });

        it('should handle empty symbol string gracefully', async () => {
            const ctx = createMockContext();
            vi.mocked(mockTradingApi.pairExists).mockResolvedValue(false);

            const result = await step.handlePairSelection(ctx, '');

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        });
    });

    describe('handleTextInput', () => {
        it('should convert text to uppercase and validate', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};
            vi.mocked(mockTradingApi.pairExists).mockResolvedValue(true);

            const result = await step.handleTextInput(ctx, 'btc');

            expect(result).toEqual({ nextStep: SceneStep.Mode });
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
        const session: { createGrid: Record<string, unknown> | undefined } = {
            createGrid: {},
        };
        return {
            session,
            scene: { leave: vi.fn() },
        } as unknown as BotContext;
    }
});
