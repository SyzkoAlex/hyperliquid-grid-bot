import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectModeStep } from './select-mode.step';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BotContext } from '../../../types/bot-context';
import { CreateGridMode } from '../create-grid-mode';
import { SceneStep } from '../create-grid-scene-step';

describe('SelectModeStep', () => {
    let step: SelectModeStep;
    let mockMessageManager: WizardMessageManager;

    beforeEach(() => {
        mockMessageManager = {
            sendEnterMessage: vi.fn(),
        } as unknown as WizardMessageManager;

        step = new SelectModeStep(mockMessageManager);
    });

    describe('enter', () => {
        it('sends prompt with Quick and Advanced mode buttons', async () => {
            const ctx = createMockContext();

            await step.enter(ctx);

            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalledWith(
                ctx,
                expect.any(String),
                expect.arrayContaining([
                    expect.arrayContaining([
                        expect.objectContaining({ action: 'create_grid:mode:quick' }),
                    ]),
                ]),
                'HTML',
            );
        });
    });

    describe('rollbackState', () => {
        it('deletes mode from session', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { mode: CreateGridMode.Quick };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.mode).toBeUndefined();
        });

        it('does nothing when createGrid is undefined', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = undefined;

            expect(() => step.rollbackState(ctx)).not.toThrow();
        });
    });

    describe('handleModeSelection', () => {
        it('should set quick mode in session', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            const result = await step.handleModeSelection(ctx, CreateGridMode.Quick);

            expect(result).toEqual({
                nextStep: SceneStep.Quick,
                confirmations: ['✅ Quick start mode selected'],
            });
            expect(ctx.session.createGrid!.mode).toBe(CreateGridMode.Quick);
        });

        it('should set advanced mode in session', async () => {
            const ctx = createMockContext();

            const result = await step.handleModeSelection(ctx, CreateGridMode.Advanced);

            expect(result).toEqual({
                nextStep: SceneStep.Upper,
                confirmations: ['✅ Advanced mode selected'],
            });
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

    function createMockContext(): BotContext {
        const session = { createGrid: {} };
        return {
            session,
            scene: { leave: vi.fn() },
        } as unknown as BotContext;
    }
});
