import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmStep } from './confirm.step';
import { EventBus } from '@infra/events/event-bus.port';
import { BotContext } from '../../../types/bot-context';
import { CreateGridCommandEvent } from '@domain/models/events/commands/create-grid-command.event';
import { CreateGridMode } from '../create-grid-mode';
import { GridMode } from '@domain/models/grid/grid-mode';

describe('ConfirmStep', () => {
    let step: ConfirmStep;
    let mockEventBus: EventBus;

    beforeEach(() => {
        mockEventBus = {
            publish: vi.fn(),
        } as unknown as EventBus;

        step = new ConfirmStep(mockEventBus);
    });

    describe('execute', () => {
        it('should publish CreateGridCommandEvent with valid state', async () => {
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

            expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(CreateGridCommandEvent));
            expect(ctx.reply).toHaveBeenCalled();
        });

        it('should handle invalid state gracefully', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'BTC',
                // Missing required fields
            };

            await step.execute(ctx);

            expect(mockEventBus.publish).not.toHaveBeenCalled();
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
