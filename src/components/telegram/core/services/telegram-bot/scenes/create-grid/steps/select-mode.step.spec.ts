import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectModeStep } from './select-mode.step';
import { BotContext } from '../../../types/bot-context';
import { CreateGridMode } from '../create-grid-mode';

describe('SelectModeStep', () => {
    let step: SelectModeStep;

    beforeEach(() => {
        step = new SelectModeStep();
    });

    describe('handleModeSelection', () => {
        it('should set quick mode in session', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            const result = await step.handleModeSelection(ctx, CreateGridMode.Quick);

            expect(result).toBe('quick');
            expect(ctx.session.createGrid!.mode).toBe(CreateGridMode.Quick);
        });

        it('should set advanced mode in session', async () => {
            const ctx = createMockContext();

            const result = await step.handleModeSelection(ctx, CreateGridMode.Advanced);

            expect(result).toBe('advanced');
            expect(ctx.session.createGrid!.mode).toBe(CreateGridMode.Advanced);
        });

        it('should initialize createGrid if not exists', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            await step.handleModeSelection(ctx, CreateGridMode.Advanced);

            expect(ctx.session.createGrid).toBeDefined();
            expect(ctx.session.createGrid!.mode).toBe(CreateGridMode.Advanced);
        });
    });

    describe('handleBack', () => {
        it('should remove mode from session', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { mode: CreateGridMode.Quick };

            await step.handleBack(ctx);

            expect(ctx.session.createGrid!.mode).toBeUndefined();
        });
    });

    function createMockContext(): BotContext {
        const session = { createGrid: {} };
        return {
            reply: vi.fn(),
            session,
            scene: { leave: vi.fn() },
        } as unknown as BotContext;
    }
});
