import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuickStartStep } from './quick-start.step';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { BotContext } from '../../../types/bot-context';
import { Price } from '@domain/primitives/price';
import { UserBalanceExtractorService } from '@components/shared/core/services/user-balance-extractor/user-balance-extractor.service';
import { CapitalCalculatorService } from '@components/shared/core/services/capital-calculator/capital-calculator.service';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@domain/primitives/decimal';
import { UserState } from '@domain/user-state/user-state';
import { Config } from '@infra/config/config.schema';

describe('QuickStartStep', () => {
    let step: QuickStartStep;
    let mockHyperliquidClient: HyperliquidInfoClient;
    let mockUserBalanceExtractor: UserBalanceExtractorService;
    let mockCapitalCalculator: CapitalCalculatorService;
    let mockConfigService: ConfigService<Config, true>;

    beforeEach(() => {
        mockHyperliquidClient = {
            getCurrentPrice: vi.fn(),
            getUserSpotState: vi.fn(),
        } as unknown as HyperliquidInfoClient;

        mockUserBalanceExtractor = {
            extractBalances: vi.fn(),
        } as unknown as UserBalanceExtractorService;

        mockCapitalCalculator = {
            calculateDistribution: vi.fn().mockReturnValue({
                investmentUSDC: Decimal.from(500),
                investmentBase: Decimal.from(0.01),
            }),
        } as unknown as CapitalCalculatorService;

        mockConfigService = {
            get: vi.fn().mockReturnValue('0x123'),
        } as unknown as ConfigService<Config, true>;

        step = new QuickStartStep(
            mockHyperliquidClient,
            mockUserBalanceExtractor,
            mockCapitalCalculator,
            mockConfigService,
        );
    });

    describe('handleInvestmentInput', () => {
        it('should calculate grid params with ±20% range', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockHyperliquidClient.getCurrentPrice).mockResolvedValue(Price.from(50000));
            vi.mocked(mockHyperliquidClient.getUserSpotState).mockResolvedValue({} as UserState);
            vi.mocked(mockUserBalanceExtractor.extractBalances).mockReturnValue({
                usdcBalance: Decimal.from(10000),
                baseBalance: Decimal.from(1),
            });

            const result = await step.handleInvestmentInput(ctx, '1000');

            expect(result).toBe('preview');
            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBe(1000);
            expect(ctx.session.createGrid?.upperPrice).toBe(60000); // 50000 + 20%
            expect(ctx.session.createGrid?.lowerPrice).toBe(40000); // 50000 - 20%
            expect(ctx.session.createGrid?.levels).toBe(10);
        });

        it('should reject investment below minimum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            const result = await step.handleInvestmentInput(ctx, '5');

            expect(result).toBe('invalid');
        });

        it('should reject invalid number', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            const result = await step.handleInvestmentInput(ctx, 'invalid');

            expect(result).toBe('invalid');
        });

        it('should handle API error gracefully', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockHyperliquidClient.getCurrentPrice).mockRejectedValue(
                new Error('API error'),
            );

            const result = await step.handleInvestmentInput(ctx, '1000');

            expect(result).toBe('invalid');
        });

        it('should return null if no symbol in session', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleInvestmentInput(ctx, '1000');

            expect(result).toBeNull();
        });

        it('should proceed even with insufficient USDC balance', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockHyperliquidClient.getCurrentPrice).mockResolvedValue(Price.from(50000));
            vi.mocked(mockHyperliquidClient.getUserSpotState).mockResolvedValue({} as UserState);
            vi.mocked(mockUserBalanceExtractor.extractBalances).mockReturnValue({
                usdcBalance: Decimal.from(100),
                baseBalance: Decimal.from(1),
            });
            vi.mocked(mockCapitalCalculator.calculateDistribution).mockReturnValue({
                investmentUSDC: Decimal.from(500),
                investmentBase: Decimal.from(0.01),
            });

            const result = await step.handleInvestmentInput(ctx, '1000');

            expect(result).toBe('preview');
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
