import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdvancedStopLossStep } from './advanced-stop-loss.step';
import { SceneStep } from '../create-grid-scene-step';

const makeCtx = (overrides: { lowerPrice?: number } = {}) => ({
    session: {
        createGrid: {
            lowerPrice: overrides.lowerPrice ?? 2000,
            stopLossEnabled: undefined as boolean | undefined,
            stopLossPrice: undefined as number | undefined,
        },
    },
    answerCbQuery: vi.fn().mockResolvedValue(undefined),
});

describe('AdvancedStopLossStep', () => {
    let sut: AdvancedStopLossStep;
    let mockMessageManager: {
        sendEnterMessage: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockMessageManager = { sendEnterMessage: vi.fn().mockResolvedValue(undefined) };
        sut = new AdvancedStopLossStep(mockMessageManager as any);
    });

    describe('handleTextInput', () => {
        it('returns null and sends validation error when price is <= 0', async () => {
            const ctx = makeCtx();
            const result = await sut.handleTextInput(ctx as any, '0');
            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalledOnce();
        });

        it('returns null and sends validation error when price is NaN', async () => {
            const ctx = makeCtx();
            const result = await sut.handleTextInput(ctx as any, 'abc');
            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalledOnce();
        });

        it('returns null when price >= lowerPrice', async () => {
            const ctx = makeCtx({ lowerPrice: 2000 });
            const result = await sut.handleTextInput(ctx as any, '2000');
            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalledOnce();
        });

        it('returns null when price is too close to lowerPrice (< 0.5% buffer)', async () => {
            const ctx = makeCtx({ lowerPrice: 2000 });
            // 0.4% below = 1992, which is > 2000 * 0.995 = 1990
            const result = await sut.handleTextInput(ctx as any, '1992');
            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalledOnce();
        });

        it('returns StepResult with nextStep=Preview when price is valid', async () => {
            const ctx = makeCtx({ lowerPrice: 2000 });
            // 1% below lower price = 1980, passes 0.5% buffer check
            const result = await sut.handleTextInput(ctx as any, '1980');
            expect(result).not.toBeNull();
            expect(result!.nextStep).toBe(SceneStep.Preview);
            expect(ctx.session.createGrid.stopLossEnabled).toBe(true);
            expect(ctx.session.createGrid.stopLossPrice).toBe(1980);
        });
    });

    describe('handleSkip', () => {
        it('sets stopLossEnabled=false and advances to Preview', async () => {
            const ctx = makeCtx();
            const result = await sut.handleSkip(ctx as any);
            expect(result!.nextStep).toBe(SceneStep.Preview);
            expect(ctx.session.createGrid.stopLossEnabled).toBe(false);
        });
    });

    describe('rollbackState', () => {
        it('clears stopLossEnabled and stopLossPrice from session', () => {
            const ctx = makeCtx() as any;
            ctx.session.createGrid.stopLossEnabled = true;
            ctx.session.createGrid.stopLossPrice = 1980;
            sut.rollbackState(ctx);
            expect(ctx.session.createGrid.stopLossEnabled).toBeUndefined();
            expect(ctx.session.createGrid.stopLossPrice).toBeUndefined();
        });
    });
});
