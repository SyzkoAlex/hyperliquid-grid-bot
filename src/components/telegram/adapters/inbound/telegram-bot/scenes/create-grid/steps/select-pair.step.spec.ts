import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelectPairStep } from './select-pair.step';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';
import { buildPairAction } from '../create-grid-actions';

describe('SelectPairStep', () => {
    let step: SelectPairStep;
    let mockTradingApi: TradingApiPort;
    let mockMessageManager: WizardMessageManager;

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

        mockMessageManager = {
            sendEnterMessage: vi.fn(),
        } as unknown as WizardMessageManager;

        step = new SelectPairStep(mockTradingApi, mockMessageManager);
    });

    describe('enter', () => {
        it('sends prompt with HYPE button (same-symbol, no parens) and cancel', async () => {
            const ctx = createMockContext();

            await step.enter(ctx);

            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalledWith(
                ctx,
                expect.any(String),
                expect.arrayContaining([
                    expect.arrayContaining([expect.objectContaining({ text: 'HYPE' })]),
                ]),
            );
        });

        it('renders BTC (UBTC) for a token where displayName differs from symbol', async () => {
            const ctx = createMockContext();

            await step.enter(ctx);

            const [, , keyboard] = vi.mocked(mockMessageManager.sendEnterMessage).mock.calls[0];
            const rows = keyboard as { text: string; action: string }[][];
            const btcRow = rows.find((r) => r[0].text === 'BTC (UBTC)');
            expect(btcRow).toBeDefined();
        });

        it('uses on-chain symbol (UBTC) as callback_data for the BTC button', async () => {
            const ctx = createMockContext();

            await step.enter(ctx);

            const [, , keyboard] = vi.mocked(mockMessageManager.sendEnterMessage).mock.calls[0];
            const rows = keyboard as { text: string; action: string }[][];
            const btcRow = rows.find((r) => r[0].text === 'BTC (UBTC)');
            expect(btcRow![0].action).toBe(buildPairAction('UBTC'));
        });

        it('calls tradingApi.getTopSymbolsByVolume and renders all returned tokens as buttons', async () => {
            const dynamicTokens = [
                { symbol: 'TOKEN1', displayName: 'TOKEN1' },
                { symbol: 'TOKEN2', displayName: 'TOKEN2' },
                { symbol: 'TOKEN3', displayName: 'TOKEN3' },
            ];
            vi.mocked(mockTradingApi.getTopSymbolsByVolume).mockResolvedValue(dynamicTokens);
            const ctx = createMockContext();

            await step.enter(ctx);

            expect(mockTradingApi.getTopSymbolsByVolume).toHaveBeenCalledOnce();

            const [, , keyboard] = vi.mocked(mockMessageManager.sendEnterMessage).mock.calls[0];
            const tokenButtons = (keyboard as { text: string; action: string }[][]).filter((row) =>
                dynamicTokens.some((t) => t.symbol === row[0].text),
            );
            expect(tokenButtons).toHaveLength(dynamicTokens.length);
        });
    });

    describe('handleOtherPair', () => {
        it('sends other token prompt message', async () => {
            const ctx = createMockContext();

            await step.handleOtherPair(ctx);

            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalledWith(
                ctx,
                expect.any(String),
            );
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
