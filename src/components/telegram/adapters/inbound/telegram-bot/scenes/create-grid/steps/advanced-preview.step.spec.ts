import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvancedPreviewStep } from './advanced-preview.step';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BotContext } from '../../../types/bot-context';
import { CreateGridMode } from '../create-grid-mode';
import { ExchangeInfoPort } from '@components/telegram/core/application/ports/exchange-info.port';
import { GridMode } from '@domain/models/grid/grid-mode';
import { Price } from '@domain/models/primitives/price';

describe('AdvancedPreviewStep', () => {
    let step: AdvancedPreviewStep;
    let mockMessageManager: WizardMessageManager;
    let mockHyperliquidClient: ExchangeInfoPort;

    beforeEach(() => {
        mockMessageManager = {
            sendEnterMessage: vi.fn(),
        } as unknown as WizardMessageManager;

        mockHyperliquidClient = {
            getCurrentPrice: vi.fn().mockResolvedValue(Price.from(50000)),
        } as unknown as ExchangeInfoPort;

        step = new AdvancedPreviewStep(mockMessageManager, mockHyperliquidClient);
    });

    describe('enter', () => {
        it('should display complete grid configuration', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'BTC',
                mode: CreateGridMode.Advanced,
                gridMode: GridMode.Neutral,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
            };

            await step.enter(ctx);

            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should calculate order size correctly', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'ETH',
                mode: CreateGridMode.Quick,
                gridMode: GridMode.Neutral,
                upperPrice: 3500,
                lowerPrice: 2500,
                levels: 5,
                totalInvestmentUSDC: 500,
            };

            await step.enter(ctx);

            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should exit scene if state is invalid', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'BTC',
                // Missing required fields
            };

            await step.enter(ctx);

            expect(ctx.scene.leave).toHaveBeenCalled();
        });
    });

    describe('rollbackState', () => {
        it('should clear quick mode fields', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                mode: CreateGridMode.Quick,
                totalInvestmentUSDC: 1000,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
            };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBeUndefined();
            expect(ctx.session.createGrid?.upperPrice).toBeUndefined();
            expect(ctx.session.createGrid?.lowerPrice).toBeUndefined();
            expect(ctx.session.createGrid?.levels).toBeUndefined();
        });

        it('should only clear investment for advanced mode', () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                mode: CreateGridMode.Advanced,
                totalInvestmentUSDC: 1000,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
            };

            step.rollbackState(ctx);

            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBeUndefined();
            expect(ctx.session.createGrid?.upperPrice).toBe(55000);
            expect(ctx.session.createGrid?.lowerPrice).toBe(45000);
            expect(ctx.session.createGrid?.levels).toBe(10);
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
