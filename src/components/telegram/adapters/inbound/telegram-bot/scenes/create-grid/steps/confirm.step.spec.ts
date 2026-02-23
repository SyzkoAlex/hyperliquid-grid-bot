import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmStep } from './confirm.step';
import { CreateGridUseCase } from '@components/telegram/core/application/use-cases/create-grid/create-grid.use-case';
import { BotContext } from '../../../types/bot-context';
import { CreateGridMode } from '../create-grid-mode';
import { GridMode } from '@domain/models/grid/grid-mode';

describe('ConfirmStep', () => {
    let step: ConfirmStep;
    let mockCreateGridUseCase: CreateGridUseCase;

    beforeEach(() => {
        mockCreateGridUseCase = {
            execute: vi.fn(),
        } as unknown as CreateGridUseCase;

        step = new ConfirmStep(mockCreateGridUseCase);
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
                gridMode: GridMode.Neutral,
            };

            await step.execute(ctx);

            expect(mockCreateGridUseCase.execute).toHaveBeenCalledWith({
                symbol: 'BTC',
                mode: GridMode.Neutral,
                lowerPrice: 45000,
                upperPrice: 55000,
                levels: 10,
                totalInvestmentUSDC: 1000,
            });
            expect(ctx.reply).toHaveBeenCalled();
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
            reply: vi.fn(),
            session,
            scene: { leave: vi.fn() },
        } as unknown as BotContext;
    }
});
