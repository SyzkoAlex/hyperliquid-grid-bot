import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuickStartStep } from './quick-start.step';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { WizardContext } from '../../../../../core/domain/wizard-context';
import { Price } from '@domain/primitives/price';

describe('QuickStartStep', () => {
    let step: QuickStartStep;
    let mockHyperliquidClient: HyperliquidInfoClient;

    beforeEach(() => {
        mockHyperliquidClient = {
            getCurrentPrice: vi.fn(),
        } as unknown as HyperliquidInfoClient;

        step = new QuickStartStep(mockHyperliquidClient);
    });

    describe('handleInvestmentInput', () => {
        it('should calculate grid params with ±20% range', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { symbol: 'BTC' };
            vi.mocked(mockHyperliquidClient.getCurrentPrice).mockResolvedValue(Price.from(50000));

            const result = await step.handleInvestmentInput(ctx, '1000');

            expect(result).toBe('preview');
            expect(ctx.getSession().createGrid?.totalInvestmentUSDC).toBe(1000);
            expect(ctx.getSession().createGrid?.upperPrice).toBe(60000); // 50000 + 20%
            expect(ctx.getSession().createGrid?.lowerPrice).toBe(40000); // 50000 - 20%
            expect(ctx.getSession().createGrid?.levels).toBe(10);
        });

        it('should reject investment below minimum', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { symbol: 'BTC' };

            const result = await step.handleInvestmentInput(ctx, '5');

            expect(result).toBe('invalid');
            expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Minimum investment'));
        });

        it('should reject invalid number', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { symbol: 'BTC' };

            const result = await step.handleInvestmentInput(ctx, 'invalid');

            expect(result).toBe('invalid');
            expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid amount'));
        });

        it('should handle API error gracefully', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { symbol: 'BTC' };
            vi.mocked(mockHyperliquidClient.getCurrentPrice).mockRejectedValue(
                new Error('API error'),
            );

            const result = await step.handleInvestmentInput(ctx, '1000');

            expect(result).toBe('invalid');
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('Failed to fetch current price'),
            );
        });

        it('should return null if no symbol in session', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = {};

            const result = await step.handleInvestmentInput(ctx, '1000');

            expect(result).toBeNull();
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
