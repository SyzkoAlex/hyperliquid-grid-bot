import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvestmentValidationParams, validateInvestment } from './investment-validator';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { WIZARD_CONFIG } from '@components/telegram/core/domain/models/constants/wizard-config';

describe('validateInvestment', () => {
    let mockTradingApi: TradingApiPort;

    const defaultParams: InvestmentValidationParams = {
        investment: 1000,
        levels: 10,
        symbol: 'HYPE',
        upperPrice: 11,
        lowerPrice: 9,
        accountAddress: '0xABC',
    };

    function mockUserState(
        overrides: Partial<{ usdcBalance: number; spotBalances: Record<string, number> }> = {},
    ) {
        const usdcBalance = overrides.usdcBalance ?? 10000;
        const spotBalances = overrides.spotBalances ?? { HYPE: 1000 };
        return {
            usdcBalance,
            usdc: { available: usdcBalance, total: usdcBalance, hold: 0 },
            spotBalances,
            spotPositions: Object.fromEntries(
                Object.entries(spotBalances).map(([k, v]) => [
                    k,
                    { available: v, total: v, hold: 0 },
                ]),
            ),
        };
    }

    beforeEach(() => {
        mockTradingApi = {
            getCurrentPrice: vi.fn().mockResolvedValue(10),
            getUserSpotState: vi.fn().mockResolvedValue(mockUserState()),
            pairExists: vi.fn(),
            calculateCapitalDistribution: vi.fn().mockReturnValue({
                investmentUSDC: 500,
                investmentBase: 50,
            }),
        } as unknown as TradingApiPort;
    });

    it('returns valid result with distribution when balance is sufficient', async () => {
        const result = await validateInvestment(defaultParams, mockTradingApi);

        expect(result.valid).toBe(true);
        expect(result.distribution).toBeDefined();
        expect(result.distribution!.investmentUSDC.toNumber()).toBe(500);
        expect(result.distribution!.investmentBase.toNumber()).toBe(50);
    });

    it('rejects NaN investment', async () => {
        const result = await validateInvestment(
            { ...defaultParams, investment: NaN },
            mockTradingApi,
        );

        expect(result.valid).toBe(false);
        expect(result.errorMessage).toBeDefined();
        expect(result.showBackButton).toBeUndefined();
    });

    it('rejects investment below minimum', async () => {
        const result = await validateInvestment(
            { ...defaultParams, investment: WIZARD_CONFIG.MIN_INVESTMENT - 1 },
            mockTradingApi,
        );

        expect(result.valid).toBe(false);
        expect(result.errorMessage).toBeDefined();
    });

    it('rejects when per-order amount is below minimum', async () => {
        const result = await validateInvestment(
            { ...defaultParams, investment: 50, levels: 20 }, // 50/20 = 2.5 < 10
            mockTradingApi,
        );

        expect(result.valid).toBe(false);
        expect(result.showBackButton).toBe(true);
        expect(result.errorMessage).toBeDefined();
    });

    it('rejects when USDC balance is insufficient', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue(
            mockUserState({ usdcBalance: 100, spotBalances: { HYPE: 1000 } }),
        );
        vi.mocked(mockTradingApi.calculateCapitalDistribution).mockReturnValue({
            investmentUSDC: 500,
            investmentBase: 50,
        });

        const result = await validateInvestment(defaultParams, mockTradingApi);

        expect(result.valid).toBe(false);
        expect(result.showBackButton).toBe(true);
        expect(result.errorMessage).toBeDefined();
    });

    it('rejects when base balance is insufficient', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue(
            mockUserState({ usdcBalance: 10000, spotBalances: { HYPE: 1 } }),
        );
        vi.mocked(mockTradingApi.calculateCapitalDistribution).mockReturnValue({
            investmentUSDC: 500,
            investmentBase: 50,
        });

        const result = await validateInvestment(defaultParams, mockTradingApi);

        expect(result.valid).toBe(false);
        expect(result.showBackButton).toBe(true);
    });

    it('handles missing symbol in spotBalances by defaulting to 0', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue(
            mockUserState({ usdcBalance: 10000, spotBalances: {} }),
        );
        vi.mocked(mockTradingApi.calculateCapitalDistribution).mockReturnValue({
            investmentUSDC: 500,
            investmentBase: 50,
        });

        const result = await validateInvestment(defaultParams, mockTradingApi);

        expect(result.valid).toBe(false);
        expect(result.showBackButton).toBe(true);
    });

    it('passes correct parameters to calculateCapitalDistribution', async () => {
        await validateInvestment(defaultParams, mockTradingApi);

        expect(mockTradingApi.calculateCapitalDistribution).toHaveBeenCalledWith(
            expect.objectContaining({
                totalInvestmentUSDC: 1000,
                levels: 10,
                currentPrice: 10,
                lowerPrice: 9,
                upperPrice: 11,
            }),
        );
    });

    it('accepts investment where per-order amount meets the minimum', async () => {
        // investment / (levels + 1) >= MIN_INVESTMENT
        // 20 / (1 + 1) = 10 >= 10 -- passes
        const result = await validateInvestment(
            { ...defaultParams, investment: WIZARD_CONFIG.MIN_INVESTMENT * 2, levels: 1 },
            mockTradingApi,
        );

        expect(result.valid).toBe(true);
    });

    it('accepts investment when minNotional is just below minimum due to floating-point', async () => {
        // Capital distribution returns 9.9999 — rounds to 10.00 cents, should pass.
        // Before the roundToCents fix this would be incorrectly rejected.
        // levels=1 → countBuySellLevels gives buyCount=1, sellCount=1.
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(10);
        vi.mocked(mockTradingApi.calculateCapitalDistribution).mockReturnValue({
            investmentUSDC: 9.9999,
            investmentBase: 100,
        });

        const result = await validateInvestment(
            { ...defaultParams, levels: 1, lowerPrice: 9, upperPrice: 11 },
            mockTradingApi,
        );

        expect(result.valid).toBe(true);
    });

    it('rejects investment when minNotional is genuinely below minimum after rounding', async () => {
        // 9.944 rounds to 9.94 which is still < 10 — must reject.
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(10);
        vi.mocked(mockTradingApi.calculateCapitalDistribution).mockReturnValue({
            investmentUSDC: 9.944,
            investmentBase: 100,
        });

        const result = await validateInvestment(
            { ...defaultParams, levels: 1, lowerPrice: 9, upperPrice: 11 },
            mockTradingApi,
        );

        expect(result.valid).toBe(false);
        expect(result.showBackButton).toBe(true);
    });
});
