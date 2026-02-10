import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmStep } from './confirm.step';
import { EventBus } from '@infra/events/event-bus.port';
import { WizardContext } from '../../../../../core/domain/wizard-context';
import { CreateGridCommandEvent } from '@domain/events/commands/create-grid-command.event';
import { CreateGridMode } from '../../../../../core/domain/grid-mode';

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
            ctx.getSession().createGrid = {
                symbol: 'BTC',
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
                mode: CreateGridMode.Advanced,
            };

            await step.execute(ctx);

            expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(CreateGridCommandEvent));
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('Grid creation started'),
                undefined,
                'HTML',
            );
            expect(ctx.getSession().createGrid).toBeUndefined();
            expect(ctx.leaveScene).toHaveBeenCalled();
        });

        it('should handle invalid state gracefully', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = {
                symbol: 'BTC',
                // Missing required fields
            };

            await step.execute(ctx);

            expect(mockEventBus.publish).not.toHaveBeenCalled();
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('Invalid grid configuration'),
            );
            expect(ctx.leaveScene).toHaveBeenCalled();
        });

        it('should handle event bus error', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = {
                symbol: 'BTC',
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
            };

            const publishError = new Error('Bus error');
            vi.mocked(mockEventBus.publish).mockImplementation(() => {
                throw publishError;
            });

            await step.execute(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('Failed to create grid'),
            );
            expect(ctx.leaveScene).toHaveBeenCalled();
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
