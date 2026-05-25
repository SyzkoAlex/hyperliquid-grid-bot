import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmStep } from './confirm.step';
import { CreateGridUseCase } from '@components/telegram/core/application/use-cases/create-grid/create-grid.use-case';
import { PendingCreationMessageStore } from '../../../pending-creation-message.store';
import { BotContext } from '../../../types/bot-context';
import { CreateGridMode } from '../create-grid-mode';
import { CommonTexts } from '@components/telegram/core/domain/models/messages/common.texts';
import { BoardRenderer } from '../wizard/board-renderer';

describe('ConfirmStep', () => {
    let step: ConfirmStep;
    let mockCreateGridUseCase: CreateGridUseCase;
    let pendingCreationMessageStore: PendingCreationMessageStore;
    let mockBoardRenderer: Pick<BoardRenderer, 'buildSummaryFromSession'>;

    beforeEach(() => {
        mockCreateGridUseCase = {
            execute: vi.fn().mockResolvedValue(undefined),
        } as unknown as CreateGridUseCase;

        pendingCreationMessageStore = new PendingCreationMessageStore();

        mockBoardRenderer = {
            buildSummaryFromSession: vi.fn().mockReturnValue('✓ Pair · BTC'),
        };

        step = new ConfirmStep(
            mockCreateGridUseCase,
            pendingCreationMessageStore,
            mockBoardRenderer as BoardRenderer,
        );
    });

    describe('execute — with board message (new-style)', () => {
        it('should edit the board message to "Creating grid..." and store the id', async () => {
            const ctx = createMockContextWithBoard();
            ctx.session.createGrid = {
                symbol: 'BTC',
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
                mode: CreateGridMode.Advanced,
                boardChatId: 77,
                boardMessageId: 88,
            };

            await step.execute(ctx);

            expect(ctx.telegram.editMessageText).toHaveBeenCalledWith(
                77,
                88,
                undefined,
                expect.stringContaining('Creating grid'),
                expect.objectContaining({ parse_mode: 'HTML' }),
            );
            const pending = pendingCreationMessageStore.consume();
            expect(pending).toEqual({ chatId: 77, messageId: 88 });
        });

        it('should call CreateGridUseCase with valid state', async () => {
            const ctx = createMockContextWithBoard();
            ctx.session.createGrid = {
                symbol: 'BTC',
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
                mode: CreateGridMode.Advanced,
                boardChatId: 77,
                boardMessageId: 88,
            };

            await step.execute(ctx);

            expect(mockCreateGridUseCase.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 42,
                    symbol: 'BTC',
                    lowerPrice: 45000,
                    upperPrice: 55000,
                    levels: 10,
                    totalInvestmentUSDC: 1000,
                    accountAddress: '0xtest',
                }),
            );
        });

        it('falls back to reply when editMessageText fails', async () => {
            const ctx = createMockContextWithBoard();
            ctx.session.createGrid = {
                symbol: 'BTC',
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
                mode: CreateGridMode.Advanced,
                boardChatId: 77,
                boardMessageId: 88,
            };
            vi.mocked(ctx.telegram.editMessageText).mockRejectedValue(new Error('edit failed'));

            await step.execute(ctx);

            expect(ctx.reply).toHaveBeenCalled();
        });
    });

    describe('execute — without board message (old-style fallback)', () => {
        it('should call CreateGridUseCase and store reply message id', async () => {
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
                userId: 42,
                symbol: 'BTC',
                lowerPrice: 45000,
                upperPrice: 55000,
                levels: 10,
                totalInvestmentUSDC: 1000,
                accountAddress: '0xtest',
            });
            expect(ctx.reply).toHaveBeenCalled();
            const pending = pendingCreationMessageStore.consume();
            expect(pending).toEqual({ chatId: 123, messageId: 456 });
        });
    });

    describe('execute — no account address', () => {
        it('should reply with ACCOUNT_NOT_CONNECTED and not call CreateGridUseCase', async () => {
            const ctx = createMockContext();
            ctx.user = { id: 42 } as unknown as typeof ctx.user;
            ctx.session.createGrid = {
                symbol: 'BTC',
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
                mode: CreateGridMode.Advanced,
            };

            await step.execute(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(CommonTexts.ACCOUNT_NOT_CONNECTED);
            expect(mockCreateGridUseCase.execute).not.toHaveBeenCalled();
        });
    });

    describe('execute — invalid state', () => {
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
            user: { id: 42, accountAddress: '0xtest' },
            telegram: {
                editMessageText: vi.fn().mockResolvedValue(undefined),
            },
        } as unknown as BotContext;
    }

    function createMockContextWithBoard(): BotContext {
        const session = { createGrid: {} };
        return {
            reply: vi.fn().mockResolvedValue({ chat: { id: 123 }, message_id: 456 }),
            session,
            scene: { leave: vi.fn() },
            user: { id: 42, accountAddress: '0xtest' },
            telegram: {
                editMessageText: vi.fn().mockResolvedValue(undefined),
            },
        } as unknown as BotContext;
    }
});
