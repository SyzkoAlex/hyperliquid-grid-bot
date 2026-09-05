import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleInvestmentPresetSelection } from './investment-preset-selection';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';

describe('handleInvestmentPresetSelection', () => {
    let applyInvestment: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        applyInvestment = vi.fn().mockResolvedValue({ nextStep: SceneStep.Preview });
    });

    function createMockContext(): BotContext {
        return { session: { createGrid: {} } } as unknown as BotContext;
    }

    it('sets pendingError and returns null for the custom key', async () => {
        const ctx = createMockContext();

        const result = await handleInvestmentPresetSelection(ctx, 'custom', applyInvestment);

        expect(result).toBeNull();
        expect(ctx.session.createGrid?.pendingError).toBeTruthy();
        expect(applyInvestment).not.toHaveBeenCalled();
    });

    it('returns null when balanceSnapshot is missing', async () => {
        const ctx = createMockContext();

        const result = await handleInvestmentPresetSelection(ctx, '50', applyInvestment);

        expect(result).toBeNull();
        expect(applyInvestment).not.toHaveBeenCalled();
    });

    it.each([
        ['25', '250'],
        ['50', '500'],
        ['75', '750'],
        ['max', '1000'],
    ])('applies the %s preset as %s from suggestedMax 1000', async (key, expected) => {
        const ctx = createMockContext();
        ctx.session.createGrid = { balanceSnapshot: { suggestedMax: 1000 } };

        const result = await handleInvestmentPresetSelection(ctx, key, applyInvestment);

        expect(applyInvestment).toHaveBeenCalledWith(expected);
        expect(result).toEqual({ nextStep: SceneStep.Preview });
    });

    it('rounds percentage presets to whole dollars', async () => {
        const ctx = createMockContext();
        ctx.session.createGrid = { balanceSnapshot: { suggestedMax: 999 } };

        await handleInvestmentPresetSelection(ctx, '25', applyInvestment);

        expect(applyInvestment).toHaveBeenCalledWith('250');
    });

    it('returns null for an unknown preset key', async () => {
        const ctx = createMockContext();
        ctx.session.createGrid = { balanceSnapshot: { suggestedMax: 1000 } };

        const result = await handleInvestmentPresetSelection(ctx, 'bogus', applyInvestment);

        expect(result).toBeNull();
        expect(applyInvestment).not.toHaveBeenCalled();
    });
});
