import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchBalanceInfo } from './balance-info';
import { TradingApiPort } from '@components/trading/api/trading-api.port';

describe('fetchBalanceInfo', () => {
    let mockTradingApi: TradingApiPort;

    beforeEach(() => {
        mockTradingApi = {
            getCurrentPrice: vi.fn(),
            getUserSpotState: vi.fn(),
            pairExists: vi.fn(),
            calculateCapitalDistribution: vi.fn(),
            calculateMaxInvestment: vi.fn(),
        } as unknown as TradingApiPort;
    });

    it('returns correct balance info with both USDC and base token', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 1000,
            usdc: { available: 1000, total: 1000, hold: 0 },
            spotBalances: { BTC: 0.1 },
            spotPositions: {},
        });
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50000);
        vi.mocked(mockTradingApi.calculateMaxInvestment).mockReturnValue(5000);

        const result = await fetchBalanceInfo(mockTradingApi, '0xABC', 'BTC', 10, 45000, 55000);

        expect(result.usdcBalance.toNumber()).toBe(1000);
        expect(result.baseBalance.toNumber()).toBe(0.1);
        expect(result.baseInUsdc.toNumber()).toBe(5000); // 0.1 * 50000
        expect(result.totalBalance.toNumber()).toBe(6000); // 1000 + 5000
        expect(result.currentPrice).toBe(50000);
    });

    it('defaults base balance to 0 when symbol not in spotBalances', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 500,
            usdc: { available: 500, total: 500, hold: 0 },
            spotBalances: {},
            spotPositions: {},
        });
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(3000);
        vi.mocked(mockTradingApi.calculateMaxInvestment).mockReturnValue(0);

        const result = await fetchBalanceInfo(mockTradingApi, '0xABC', 'ETH', 10, 2700, 3300);

        expect(result.baseBalance.toNumber()).toBe(0);
        expect(result.baseInUsdc.toNumber()).toBe(0);
        expect(result.totalBalance.toNumber()).toBe(500);
    });

    it('delegates suggestedMaxRounded to calculateMaxInvestment', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 800,
            usdc: { available: 800, total: 800, hold: 0 },
            spotBalances: { SOL: 10 },
            spotPositions: {},
        });
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(100);
        vi.mocked(mockTradingApi.calculateMaxInvestment).mockReturnValue(1760);

        const result = await fetchBalanceInfo(mockTradingApi, '0xABC', 'SOL', 10, 80, 120);

        expect(result.suggestedMaxRounded).toBe(1760);
        expect(mockTradingApi.calculateMaxInvestment).toHaveBeenCalledWith({
            usdcBalance: 800,
            baseBalance: 10,
            currentPrice: 100,
            levels: 10,
            lowerPrice: 80,
            upperPrice: 120,
        });
    });

    it('reads baseHold from spotPositions[symbol].hold', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 500,
            usdc: { available: 500, total: 500, hold: 0 },
            spotBalances: { HYPE: 0.001 },
            spotPositions: { HYPE: { available: 0.001, total: 22.481, hold: 22.48 } },
        });
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(74);
        vi.mocked(mockTradingApi.calculateMaxInvestment).mockReturnValue(0);

        const result = await fetchBalanceInfo(mockTradingApi, '0xABC', 'HYPE', 10, 66, 82);

        expect(result.baseHold.toNumber()).toBe(22.48);
        expect(result.baseBalance.toNumber()).toBe(0.001);
    });

    it('defaults baseHold to 0 when spotPositions entry is missing', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 500,
            usdc: { available: 500, total: 500, hold: 0 },
            spotBalances: { ETH: 1 },
            spotPositions: {},
        });
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(3000);
        vi.mocked(mockTradingApi.calculateMaxInvestment).mockReturnValue(1000);

        const result = await fetchBalanceInfo(mockTradingApi, '0xABC', 'ETH', 10, 2700, 3300);

        expect(result.baseHold.toNumber()).toBe(0);
    });

    it('passes accountAddress and symbol to the trading API', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 100,
            usdc: { available: 100, total: 100, hold: 0 },
            spotBalances: {},
            spotPositions: {},
        });
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50);
        vi.mocked(mockTradingApi.calculateMaxInvestment).mockReturnValue(0);

        await fetchBalanceInfo(mockTradingApi, '0xDEF', 'HYPE', 10, 40, 60);

        expect(mockTradingApi.getUserSpotState).toHaveBeenCalledWith('0xDEF');
        expect(mockTradingApi.getCurrentPrice).toHaveBeenCalledWith('HYPE');
    });
});
