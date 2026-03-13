import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WizardMessageManager } from './wizard-message-manager';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';

describe('WizardMessageManager', () => {
    let manager: WizardMessageManager;

    beforeEach(() => {
        manager = new WizardMessageManager();
    });

    function createMockContext(stepId: SceneStep): BotContext {
        return {
            session: {
                createGrid: {
                    currentStep: stepId,
                    stepMessages: {
                        [stepId]: { enterMessageIds: [], confirmationMessageIds: [] },
                    },
                },
            },
            reply: vi.fn().mockResolvedValue({ message_id: 42 }),
            deleteMessage: vi.fn().mockResolvedValue(undefined),
        } as unknown as BotContext;
    }

    function createEmptyContext(): BotContext {
        return {
            session: { createGrid: undefined },
            reply: vi.fn().mockResolvedValue({ message_id: 42 }),
            deleteMessage: vi.fn().mockResolvedValue(undefined),
        } as unknown as BotContext;
    }

    describe('sendEnterMessage', () => {
        it('sends message and tracks messageId in step state', async () => {
            const ctx = createMockContext(SceneStep.Pair);

            await manager.sendEnterMessage(ctx, 'hello');

            expect(ctx.reply).toHaveBeenCalledWith('hello', { parse_mode: 'HTML' });
            expect(ctx.session.createGrid!.stepMessages![SceneStep.Pair].enterMessageIds).toContain(
                42,
            );
        });

        it('sends message with keyboard when buttons provided', async () => {
            const ctx = createMockContext(SceneStep.Pair);
            const buttons = [[{ text: 'OK', action: 'ok_action' }]];

            await manager.sendEnterMessage(ctx, 'hello', buttons);

            expect(ctx.reply).toHaveBeenCalledWith(
                'hello',
                expect.objectContaining({ parse_mode: 'HTML' }),
            );
        });

        it('returns early without sending if state has no currentStep', async () => {
            const ctx = createEmptyContext();

            await manager.sendEnterMessage(ctx, 'hello');

            expect(ctx.reply).not.toHaveBeenCalled();
        });
    });

    describe('sendConfirmation', () => {
        it('sends confirmation message and tracks messageId', async () => {
            const ctx = createMockContext(SceneStep.Pair);

            await manager.sendConfirmation(ctx, SceneStep.Pair, 'confirmed!');

            expect(ctx.reply).toHaveBeenCalledWith('confirmed!', { parse_mode: 'HTML' });
            expect(
                ctx.session.createGrid!.stepMessages![SceneStep.Pair].confirmationMessageIds,
            ).toContain(42);
        });

        it('returns early if createGrid session is missing', async () => {
            const ctx = createEmptyContext();

            await manager.sendConfirmation(ctx, SceneStep.Pair, 'confirmed!');

            expect(ctx.reply).not.toHaveBeenCalled();
        });
    });

    describe('deleteEnterMessages', () => {
        it('deletes all tracked enter messages and clears the array', async () => {
            const ctx = createMockContext(SceneStep.Pair);
            ctx.session.createGrid!.stepMessages![SceneStep.Pair].enterMessageIds = [10, 11];

            await manager.deleteEnterMessages(ctx, SceneStep.Pair);

            expect(ctx.deleteMessage).toHaveBeenCalledWith(10);
            expect(ctx.deleteMessage).toHaveBeenCalledWith(11);
            expect(ctx.session.createGrid!.stepMessages![SceneStep.Pair].enterMessageIds).toEqual(
                [],
            );
        });

        it('handles delete failure gracefully without throwing', async () => {
            const ctx = createMockContext(SceneStep.Pair);
            ctx.session.createGrid!.stepMessages![SceneStep.Pair].enterMessageIds = [10];
            vi.mocked(ctx.deleteMessage).mockRejectedValue(new Error('message not found'));

            await expect(manager.deleteEnterMessages(ctx, SceneStep.Pair)).resolves.not.toThrow();
        });
    });

    describe('deleteConfirmationMessages', () => {
        it('deletes all tracked confirmation messages and clears the array', async () => {
            const ctx = createMockContext(SceneStep.Pair);
            ctx.session.createGrid!.stepMessages![SceneStep.Pair].confirmationMessageIds = [20, 21];

            await manager.deleteConfirmationMessages(ctx, SceneStep.Pair);

            expect(ctx.deleteMessage).toHaveBeenCalledWith(20);
            expect(ctx.deleteMessage).toHaveBeenCalledWith(21);
            expect(
                ctx.session.createGrid!.stepMessages![SceneStep.Pair].confirmationMessageIds,
            ).toEqual([]);
        });

        it('handles delete failure gracefully without throwing', async () => {
            const ctx = createMockContext(SceneStep.Pair);
            ctx.session.createGrid!.stepMessages![SceneStep.Pair].confirmationMessageIds = [20];
            vi.mocked(ctx.deleteMessage).mockRejectedValue(new Error('message not found'));

            await expect(
                manager.deleteConfirmationMessages(ctx, SceneStep.Pair),
            ).resolves.not.toThrow();
        });

        it('does nothing when no confirmation messages exist', async () => {
            const ctx = createMockContext(SceneStep.Pair);

            await manager.deleteConfirmationMessages(ctx, SceneStep.Pair);

            expect(ctx.deleteMessage).not.toHaveBeenCalled();
        });
    });

    describe('deleteAllMessages', () => {
        it('deletes all messages across all steps', async () => {
            const ctx = createMockContext(SceneStep.Pair);
            ctx.session.createGrid!.stepMessages = {
                [SceneStep.Pair]: { enterMessageIds: [10], confirmationMessageIds: [20] },
                [SceneStep.Mode]: { enterMessageIds: [30], confirmationMessageIds: [] },
            };

            await manager.deleteAllMessages(ctx);

            expect(ctx.deleteMessage).toHaveBeenCalledTimes(3);
            expect(ctx.deleteMessage).toHaveBeenCalledWith(10);
            expect(ctx.deleteMessage).toHaveBeenCalledWith(20);
            expect(ctx.deleteMessage).toHaveBeenCalledWith(30);
        });

        it('does nothing if stepMessages is missing', async () => {
            const ctx = createMockContext(SceneStep.Pair);
            ctx.session.createGrid!.stepMessages = undefined;

            await manager.deleteAllMessages(ctx);

            expect(ctx.deleteMessage).not.toHaveBeenCalled();
        });
    });

    describe('initStep', () => {
        it('resets step message tracking for the given step', () => {
            const ctx = createMockContext(SceneStep.Pair);
            ctx.session.createGrid!.stepMessages![SceneStep.Pair] = {
                enterMessageIds: [10, 11],
                confirmationMessageIds: [20],
            };

            manager.initStep(ctx, SceneStep.Pair);

            expect(ctx.session.createGrid!.stepMessages![SceneStep.Pair]).toEqual({
                enterMessageIds: [],
                confirmationMessageIds: [],
            });
        });

        it('does nothing if createGrid session is missing', () => {
            const ctx = createEmptyContext();

            expect(() => manager.initStep(ctx, SceneStep.Pair)).not.toThrow();
        });
    });
});
