import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmStep } from './confirm.step';
import { CreateGridUseCase } from '@components/telegram/core/application/use-cases/create-grid/create-grid.use-case';
import { PendingCreationMessageStore } from '../../../pending-creation-message.store';
import { BotContext } from '../../../types/bot-context';
import { CreateGridMode } from '../create-grid-mode';

describe('ConfirmStep', () => {
    let step: ConfirmStep;
    let mockCreateGridUseCase: CreateGridUseCase;
    let pendingCreationMessageStore: PendingCreationMessageStore;

    beforeEach(() => {
        mockCreateGridUseCase = {
            execute: vi.fn().mockResolvedValue(undefined),
        } as unknown as CreateGridUseCase;

        pendingCreationMessageStore = new PendingCreationMessageStore();

        step = new ConfirmStep(mockCreateGridUseCase, pendingCreationMessageStore);
    });

    describe('execute', () => {
        it('should call CreateGridUseCase with valid state', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'BTC',
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
                mode: CreateGridMode.Advanced,
            };

            await step.execute(ctx);

            expect(mockCreateGridUseCase.execute).toHaveBeenCalledWith({
                symbol: 'BTC',
                lowerPrice: 45000,
                upperPrice: 55000,
                levels: 10,
                totalInvestmentUSDC: 1000,
                accountAddress: '0xtest',
            });
            expect(ctx.reply).toHaveBeenCalled();
        });

        it('should store pending creation message for later editing', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'BTC',
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
                mode: CreateGridMode.Advanced,
            };

            await step.execute(ctx);

            const pending = pendingCreationMessageStore.consume();
            expect(pending).toEqual({ chatId: 123, messageId: 456 });
        });

        it('should handle invalid state gracefully', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'BTC',
                // Missing required fields
            };

            await step.execute(ctx);

            expect(mockCreateGridUseCase.execute).not.toHaveBeenCalled();
            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Invalid grid configuration. Please start over.',
            );
        });
    });

    function createMockContext(): BotContext {
        const session = { createGrid: {} };
        return {
            reply: vi.fn().mockResolvedValue({ chat: { id: 123 }, message_id: 456 }),
            session,
            scene: { leave: vi.fn() },
            user: { accountAddress: '0xtest' },
        } as unknown as BotContext;
    }
});
