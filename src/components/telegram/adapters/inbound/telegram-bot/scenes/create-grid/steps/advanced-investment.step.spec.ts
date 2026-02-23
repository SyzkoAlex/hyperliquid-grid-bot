import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedInvestmentStep } from './advanced-investment.step';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';
import { ExchangeInfoPort } from '@components/telegram/core/application/ports/exchange-info.port';
import { UserBalanceExtractorService } from '@domain/services/user-balance-extractor/user-balance-extractor.service';
import { CapitalCalculatorService } from '@domain/services/capital-calculator/capital-calculator.service';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@domain/models/primitives/decimal';
import { Price } from '@domain/models/primitives/price';
import { Config } from '@/config/config.schema';

describe('AdvancedInvestmentStep', () => {
    let step: AdvancedInvestmentStep;
    let mockMessageManager: WizardMessageManager;
    let mockHyperliquidClient: ExchangeInfoPort;
    let mockUserBalanceExtractor: UserBalanceExtractorService;
    let mockCapitalCalculator: CapitalCalculatorService;
    let mockConfigService: ConfigService<Config, true>;

    beforeEach(() => {
        mockMessageManager = {
            sendEnterMessage: vi.fn(),
        } as unknown as WizardMessageManager;

        mockHyperliquidClient = {
            getCurrentPrice: vi.fn().mockResolvedValue(Price.from(10)),
            getUserSpotState: vi.fn().mockResolvedValue({}),
        } as unknown as ExchangeInfoPort;

        mockUserBalanceExtractor = {
            extractBalances: vi.fn().mockReturnValue({
                usdcBalance: Decimal.from(10000),
                baseBalance: Decimal.from(1000),
            }),
        } as unknown as UserBalanceExtractorService;

        mockCapitalCalculator = {
            calculateDistribution: vi.fn().mockReturnValue({
                investmentUSDC: Decimal.from(500),
                investmentBase: Decimal.from(50),
            }),
        } as unknown as CapitalCalculatorService;

        mockConfigService = {
            get: vi.fn().mockReturnValue('0x123'),
        } as unknown as ConfigService<Config, true>;

        step = new AdvancedInvestmentStep(
            mockMessageManager,
            mockHyperliquidClient,
            mockUserBalanceExtractor,
            mockCapitalCalculator,
            mockConfigService,
        );
    });

    describe('handleTextInput', () => {
        it('should accept valid investment amount with sufficient balance', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 10,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toEqual({
                nextStep: SceneStep.Preview,
                confirmations: ['✅ Investment set: 1000 USDC'],
            });
            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBe(1000);
        });

        it('should reject investment below minimum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 10,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            const result = await step.handleTextInput(ctx, '5');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should reject when per-order amount is too small', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 20,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            const result = await step.handleTextInput(ctx, '50'); // 50/20 = 2.5 < 10

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should reject when balance is insufficient', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 10,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            // Mock insufficient balance
            mockCapitalCalculator.calculateDistribution = vi.fn().mockReturnValue({
                investmentUSDC: Decimal.from(15000), // More than available balance
                investmentBase: Decimal.from(50),
            });

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should reject non-numeric input', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                levels: 10,
                symbol: 'HYPE',
                upperPrice: 11,
                lowerPrice: 9,
            };

            const result = await step.handleTextInput(ctx, 'abc');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should return null if required state not set', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { levels: 10 }; // Missing symbol, upperPrice, lowerPrice

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
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
