import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildInvestmentView } from './investment-view-builder';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { SwapSide } from '@components/trading/api/dto/optimal-swap.dto';

describe('buildInvestmentView', () => {
    let mockTradingApi: TradingApiPort;

    const promptFactory = {
        fallback: () => 'Fallback body',
        withBalance: (info: { suggestedMax: number }) => `Balance body (max: ${info.suggestedMax})`,
    };

    const baseUserState = {
        usdcBalance: 6550,
        usdc: { available: 6550, total: 6550, hold: 0 },
        spotBalances: { HYPE: 17.59 },
        spotPositions: { HYPE: { available: 17.59, total: 17.59, hold: 0 } },
    };

    beforeEach(() => {
        mockTradingApi = {
            getCurrentPrice: vi.fn().mockResolvedValue(53),
            getUserSpotState: vi.fn().mockResolvedValue(baseUserState),
            calculateMaxInvestment: vi.fn().mockReturnValue(1896),
            calculateOptimalSwap: vi.fn().mockReturnValue(null),
            getMinOrderNotional: vi.fn().mockReturnValue(10),
            calculateCapitalDistribution: vi.fn(),
            pairExists: vi.fn(),
            getCurrentPrices: vi.fn(),
            executeSpotSwap: vi.fn(),
            probeAgentApproval: vi.fn(),
            getTopSymbolsByVolume: vi.fn(),
        } as unknown as TradingApiPort;
    });

    it('returns fallback body when balance fetch throws', async () => {
        vi.mocked(mockTradingApi.getCurrentPrice).mockRejectedValue(new Error('API down'));

        const result = await buildInvestmentView(
            mockTradingApi,
            '0xabc',
            'HYPE',
            10,
            45,
            65,
            promptFactory,
        );

        expect(result.body).toBe('Fallback body');
        expect(result.suggestedMax).toBeNull();
        expect(result.swapOffer).toBeNull();
    });

    it('returns normal balance body and no swap offer when balances are perfectly balanced', async () => {
        vi.mocked(mockTradingApi.calculateOptimalSwap).mockReturnValue(null);

        const result = await buildInvestmentView(
            mockTradingApi,
            '0xabc',
            'HYPE',
            10,
            45,
            65,
            promptFactory,
        );

        expect(result.body).toBe('Balance body (max: 1896)');
        expect(result.suggestedMax).toBe(1896);
        expect(result.swapOffer).toBeNull();
    });

    it('appends proactive hint and sets swapOffer when imbalance exists on normal balance screen', async () => {
        vi.mocked(mockTradingApi.calculateOptimalSwap).mockReturnValue({
            side: SwapSide.UsdcToBase,
            amountUsdc: 2801,
            expectedReceived: 52,
        });

        const result = await buildInvestmentView(
            mockTradingApi,
            '0xabc',
            'HYPE',
            10,
            45,
            65,
            promptFactory,
        );

        expect(result.body).toContain('Balance body (max: 1896)');
        expect(result.body).toContain('Max without swap: ~1,896 USDC');
        expect(result.body).toContain('2,801.00 USDC');
        expect(result.swapOffer).not.toBeNull();
        expect(result.swapOffer?.amountUsdc).toBe(2801);
        expect(result.suggestedMax).toBe(1896);
    });

    it('appends proactive hint and sets swapOffer for BaseToUsdc direction', async () => {
        // amountUsdc must be >= minOrderNotional (10) to pass buildEligibleSwapOffer filter
        vi.mocked(mockTradingApi.calculateOptimalSwap).mockReturnValue({
            side: SwapSide.BaseToUsdc,
            amountUsdc: 55,
            expectedReceived: 1100,
        });

        const result = await buildInvestmentView(
            mockTradingApi,
            '0xabc',
            'HYPE',
            10,
            45,
            65,
            promptFactory,
        );

        expect(result.body).toContain('Balance body (max: 1896)');
        expect(result.body).toContain('Max without swap: ~1,896 USDC');
        expect(result.body).toContain('55.00 HYPE');
        expect(result.body).toContain('1,100.00 USDC');
        expect(result.swapOffer).not.toBeNull();
        expect(result.swapOffer?.side).toBe(SwapSide.BaseToUsdc);
        expect(result.suggestedMax).toBe(1896);
    });

    it('does not show proactive hint when swap amount is below min notional', async () => {
        vi.mocked(mockTradingApi.calculateOptimalSwap).mockReturnValue({
            side: SwapSide.UsdcToBase,
            amountUsdc: 5,
            expectedReceived: 0.1,
        });
        vi.mocked(mockTradingApi.getMinOrderNotional).mockReturnValue(10);

        const result = await buildInvestmentView(
            mockTradingApi,
            '0xabc',
            'HYPE',
            10,
            45,
            65,
            promptFactory,
        );

        expect(result.body).toBe('Balance body (max: 1896)');
        expect(result.swapOffer).toBeNull();
    });

    it('shows zero base balance warning when base token is zero', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 6550,
            usdc: { available: 6550, total: 6550, hold: 0 },
            spotBalances: {},
            spotPositions: {},
        });

        const result = await buildInvestmentView(
            mockTradingApi,
            '0xabc',
            'HYPE',
            10,
            45,
            65,
            promptFactory,
        );

        expect(result.body).toContain('You have no HYPE tokens');
        expect(result.suggestedMax).toBeNull();
    });

    it('shows zero USDC balance warning when USDC is zero', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 0,
            usdc: { available: 0, total: 0, hold: 0 },
            spotBalances: { HYPE: 17.59 },
            spotPositions: { HYPE: { available: 17.59, total: 17.59, hold: 0 } },
        });

        const result = await buildInvestmentView(
            mockTradingApi,
            '0xabc',
            'HYPE',
            10,
            45,
            65,
            promptFactory,
        );

        expect(result.body).toContain('You have no USDC');
        expect(result.suggestedMax).toBeNull();
    });

    it('shows insufficient balance warning when suggestedMax is below minimum required', async () => {
        vi.mocked(mockTradingApi.calculateMaxInvestment).mockReturnValue(5);

        const result = await buildInvestmentView(
            mockTradingApi,
            '0xabc',
            'HYPE',
            10,
            45,
            65,
            promptFactory,
        );

        expect(result.body).toContain('Insufficient balance');
        expect(result.suggestedMax).toBeNull();
    });
});
