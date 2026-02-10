import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelectModeStep } from './select-mode.step';
import { WizardContext } from '../../../../../core/domain/wizard-context';
import { CreateGridMode } from '../../../../../core/domain/grid-mode';

describe('SelectModeStep', () => {
    let step: SelectModeStep;

    beforeEach(() => {
        step = new SelectModeStep();
    });

    describe('handleModeSelection', () => {
        it('should set quick mode in session', async () => {
            const ctx = createMockContext();

            const result = await step.handleModeSelection(ctx, CreateGridMode.Quick);

            expect(result).toBe('quick');
            expect(ctx.getSession().createGrid?.mode).toBe(CreateGridMode.Quick);
            expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Quick start'));
        });

        it('should set advanced mode in session', async () => {
            const ctx = createMockContext();

            const result = await step.handleModeSelection(ctx, CreateGridMode.Advanced);

            expect(result).toBe('advanced');
            expect(ctx.getSession().createGrid?.mode).toBe(CreateGridMode.Advanced);
            expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Advanced'));
        });

        it('should initialize createGrid if not exists', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = undefined;

            await step.handleModeSelection(ctx, CreateGridMode.Quick);

            expect(ctx.getSession().createGrid).toBeDefined();
            expect(ctx.getSession().createGrid?.mode).toBe(CreateGridMode.Quick);
        });
    });

    describe('handleBack', () => {
        it('should remove mode from session', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { mode: CreateGridMode.Quick };

            await step.handleBack(ctx);

            expect(ctx.getSession().createGrid?.mode).toBeUndefined();
        });
    });

    function createMockContext(): WizardContext {
        const session = { createGrid: {} };
        return {
            reply: vi.fn(),
            getSession: vi.fn(() => session),
            leaveScene: vi.fn(),
        } as unknown as WizardContext;
    }
});
