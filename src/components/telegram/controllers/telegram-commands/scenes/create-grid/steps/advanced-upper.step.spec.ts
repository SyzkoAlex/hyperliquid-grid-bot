import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedUpperStep } from './advanced-upper.step';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { WizardContext } from '../../../../../core/domain/wizard-context';
import { Price } from '@domain/primitives/price';

describe('AdvancedUpperStep', () => {
    let step: AdvancedUpperStep;
    let mockHyperliquidClient: HyperliquidInfoClient;

    beforeEach(() => {
        mockHyperliquidClient = {
            getCurrentPrice: vi.fn(),
        } as unknown as HyperliquidInfoClient;

        step = new AdvancedUpperStep(mockHyperliquidClient);
    });

    describe('enter', () => {
        it('should show current price if symbol exists', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { symbol: 'BTC' };
            vi.mocked(mockHyperliquidClient.getCurrentPrice).mockResolvedValue(Price.from(50000));

            await step.enter(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('Current BTC price: 50000'),
                expect.any(Object),
            );
        });

        it('should handle price fetch error gracefully', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = { symbol: 'BTC' };
            vi.mocked(mockHyperliquidClient.getCurrentPrice).mockRejectedValue(
                new Error('API error'),
            );

            await step.enter(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('Could not fetch current price'),
                expect.any(Object),
            );
        });
    });

    describe('handlePriceInput', () => {
        it('should accept valid upper price', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = {};

            const result = await step.handlePriceInput(ctx, '55000');

            expect(result).toBe('lower');
            expect(ctx.getSession().createGrid?.upperPrice).toBe(55000);
            expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Upper price set'));
        });

        it('should reject zero or negative price', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = {};

            const result = await step.handlePriceInput(ctx, '0');

            expect(result).toBe('invalid');
            expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid price'));
        });

        it('should reject non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = {};

            const result = await step.handlePriceInput(ctx, 'abc');

            expect(result).toBe('invalid');
        });

        it('should return null if session not initialized', async () => {
            const ctx = createMockContext();
            ctx.getSession().createGrid = undefined;

            const result = await step.handlePriceInput(ctx, '55000');

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
