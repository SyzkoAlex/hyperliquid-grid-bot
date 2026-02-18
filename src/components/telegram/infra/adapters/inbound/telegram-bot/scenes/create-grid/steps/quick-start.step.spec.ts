import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuickStartStep } from './quick-start.step';
import { InfoClientPort } from '@domain/ports/outbound/info-client.port';
import { WizardMessageManager } from '../wizard/wizard-message-manager';
import { BotContext } from '../../../types/bot-context';
import { Price } from '@domain/models/primitives/price';
import { UserBalanceExtractorService } from '@domain/services/user-balance-extractor/user-balance-extractor.service';
import { CapitalCalculatorService } from '@domain/services/capital-calculator/capital-calculator.service';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@domain/models/primitives/decimal';
import { UserState } from '@domain/models/user-state/user-state';
import { Config } from '@infra/config/config.schema';
import { SceneStep } from '../create-grid-scene-step';

describe('QuickStartStep', () => {
    let step: QuickStartStep;
    let mockHyperliquidClient: InfoClientPort;
    let mockUserBalanceExtractor: UserBalanceExtractorService;
    let mockCapitalCalculator: CapitalCalculatorService;
    let mockConfigService: ConfigService<Config, true>;
    let mockMessageManager: WizardMessageManager;

    beforeEach(() => {
        mockHyperliquidClient = {
            getCurrentPrice: vi.fn(),
            getUserSpotState: vi.fn(),
        } as unknown as InfoClientPort;

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

        mockMessageManager = {
            sendEnterMessage: vi.fn(),
        } as unknown as WizardMessageManager;

        step = new QuickStartStep(
            mockHyperliquidClient,
            mockUserBalanceExtractor,
            mockCapitalCalculator,
            mockMessageManager,
            mockConfigService,
        );
    });

    describe('handleTextInput', () => {
        it('should calculate grid params with ±20% range and sufficient balance', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockHyperliquidClient.getCurrentPrice).mockResolvedValue(Price.from(50000));
            vi.mocked(mockHyperliquidClient.getUserSpotState).mockResolvedValue({} as UserState);
            vi.mocked(mockUserBalanceExtractor.extractBalances).mockReturnValue({
                usdcBalance: Decimal.from(10000),
                baseBalance: Decimal.from(1),
            });

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toEqual({
                nextStep: SceneStep.Preview,
                confirmations: ['✅ Investment set: 1000 USDC'],
            });
            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBe(1000);
            expect(ctx.session.createGrid?.upperPrice).toBe(60000); // 50000 + 20%
            expect(ctx.session.createGrid?.lowerPrice).toBe(40000); // 50000 - 20%
            expect(ctx.session.createGrid?.levels).toBe(10);
        });

        it('should reject investment below minimum', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            const result = await step.handleTextInput(ctx, '5');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should reject invalid number', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };

            const result = await step.handleTextInput(ctx, 'invalid');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should handle API error gracefully', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { symbol: 'BTC' };
            vi.mocked(mockHyperliquidClient.getCurrentPrice).mockRejectedValue(
                new Error('API error'),
            );

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
        });

        it('should return null if no symbol in session', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
        });

        it('should reject with insufficient USDC balance', async () => {
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

            const result = await step.handleTextInput(ctx, '1000');

            expect(result).toBeNull();
            expect(mockMessageManager.sendEnterMessage).toHaveBeenCalled();
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
