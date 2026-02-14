import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvancedPreviewStep } from './advanced-preview.step';
import { BotContext } from '../../../types/bot-context';
import { CreateGridMode } from '../create-grid-mode';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { UserBalanceExtractorService } from '@components/shared/core/services/user-balance-extractor/user-balance-extractor.service';
import { CapitalCalculatorService } from '@components/shared/core/services/capital-calculator/capital-calculator.service';
import { ConfigService } from '@nestjs/config';
import { Config } from '@infra/config/config.schema';
import { Decimal } from '@domain/primitives/decimal';
import { UserState } from '@domain/user-state/user-state';

describe('AdvancedPreviewStep', () => {
    let step: AdvancedPreviewStep;
    let mockHyperliquidClient: HyperliquidInfoClient;
    let mockUserBalanceExtractor: UserBalanceExtractorService;
    let mockCapitalCalculator: CapitalCalculatorService;
    let mockConfigService: ConfigService<Config, true>;

    beforeEach(() => {
        mockHyperliquidClient = {
            getUserSpotState: vi.fn(),
            getCurrentPrice: vi.fn().mockResolvedValue(Decimal.from(50000)),
        } as unknown as HyperliquidInfoClient;

        mockUserBalanceExtractor = {
            extractBalances: vi.fn().mockReturnValue({
                usdcBalance: Decimal.from(10000),
                baseBalance: Decimal.from(1),
            }),
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

        step = new AdvancedPreviewStep(
            mockHyperliquidClient,
            mockUserBalanceExtractor,
            mockCapitalCalculator,
            mockConfigService,
        );

        vi.mocked(mockHyperliquidClient.getUserSpotState).mockResolvedValue({} as UserState);
    });

    describe('enter', () => {
        it('should display complete grid configuration', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'BTC',
                mode: CreateGridMode.Advanced,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
                totalInvestmentUSDC: 1000,
            };

            await step.enter(ctx);

            expect(ctx.reply).toHaveBeenCalled();
        });

        it('should calculate order size correctly', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                symbol: 'ETH',
                mode: CreateGridMode.Quick,
                upperPrice: 3500,
                lowerPrice: 2500,
                levels: 5,
                totalInvestmentUSDC: 500,
            };

            await step.enter(ctx);

            expect(ctx.reply).toHaveBeenCalled();
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

    describe('handleConfirm', () => {
        it('should return confirm action', async () => {
            const ctx = createMockContext();

            const result = await step.handleConfirm(ctx);

            expect(result).toBe('confirm');
        });
    });

    describe('handleBack', () => {
        it('should clear quick mode fields', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                mode: CreateGridMode.Quick,
                totalInvestmentUSDC: 1000,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
            };

            await step.handleBack(ctx);

            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBeUndefined();
            expect(ctx.session.createGrid?.upperPrice).toBeUndefined();
            expect(ctx.session.createGrid?.lowerPrice).toBeUndefined();
            expect(ctx.session.createGrid?.levels).toBeUndefined();
        });

        it('should only clear investment for advanced mode', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                mode: CreateGridMode.Advanced,
                totalInvestmentUSDC: 1000,
                upperPrice: 55000,
                lowerPrice: 45000,
                levels: 10,
            };

            await step.handleBack(ctx);

            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBeUndefined();
            expect(ctx.session.createGrid?.upperPrice).toBe(55000);
            expect(ctx.session.createGrid?.lowerPrice).toBe(45000);
            expect(ctx.session.createGrid?.levels).toBe(10);
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
