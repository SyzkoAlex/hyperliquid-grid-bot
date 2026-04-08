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

        const result = await fetchBalanceInfo(mockTradingApi, '0xABC', 'ETH', 10, 2700, 3300);

        expect(result.baseBalance.toNumber()).toBe(0);
        expect(result.baseInUsdc.toNumber()).toBe(0);
        expect(result.totalBalance.toNumber()).toBe(500);
    });

    it('calculates suggestedMaxRounded with geometry-based formula', async () => {
        // USDC=800, base=10 SOL @ $100, range $80-$120, 10 levels
        // priceStep=4, levelPrices: 80,84,88,92,96,100,104,108,112,116,120
        // buyCount=5 (80,84,88,92,96 < 100), sellCount=6 (100,104,...,120 >= 100), totalLevels=11
        // buyRatio=5/11, sellRatio=6/11
        // maxFromUsdc = 800 / (5/11) = 1760
        // maxFromBase = 1000 / (6/11) = 1833.33
        // suggestedMax = floor(1760) = 1760
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 800,
            usdc: { available: 800, total: 800, hold: 0 },
            spotBalances: { SOL: 10 },
            spotPositions: {},
        });
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(100);

        const result = await fetchBalanceInfo(mockTradingApi, '0xABC', 'SOL', 10, 80, 120);

        expect(result.suggestedMaxRounded).toBe(1760);
    });

    it('uses maxFromBase when it is the binding constraint', async () => {
        // USDC=5000, base=100 HYPE @ $10, range $8-$12, 10 levels
        // priceStep=0.4, levelPrices: 8,8.4,...,10,...,12
        // All levels < 10: 8,8.4,8.8,9.2,9.6 => buyCount=5
        // All levels >= 10: 10,10.4,...,12 => sellCount=6, totalLevels=11
        // buyRatio=5/11, sellRatio=6/11
        // maxFromUsdc = 5000 / (5/11) = 11000
        // maxFromBase = (100*10) / (6/11) = 1000 / (6/11) = 1833.33
        // suggestedMax = floor(1833.33) = 1833
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 5000,
            usdc: { available: 5000, total: 5000, hold: 0 },
            spotBalances: { HYPE: 100 },
            spotPositions: {},
        });
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(10);

        const result = await fetchBalanceInfo(mockTradingApi, '0xABC', 'HYPE', 10, 8, 12);

        expect(result.suggestedMaxRounded).toBe(1833);
    });

    it('floors suggestedMaxRounded when result is not integer', async () => {
        // ETH=1 @ $3000, USDC=333.7, range $2700-$3300, 10 levels
        // priceStep=60, levelPrices: 2700,2760,...,3000,...,3300
        // buyCount=5 (2700,2760,2820,2880,2940 < 3000)
        // sellCount=6 (3000,...,3300 >= 3000), totalLevels=11
        // buyRatio=5/11, sellRatio=6/11
        // maxFromUsdc = 333.7 / (5/11) = 333.7 * 11/5 = 734.14
        // maxFromBase = (1*3000) / (6/11) = 3000 * 11/6 = 5500
        // suggestedMax = floor(734.14) = 734
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 333.7,
            usdc: { available: 333.7, total: 333.7, hold: 0 },
            spotBalances: { ETH: 1 },
            spotPositions: {},
        });
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(3000);

        const result = await fetchBalanceInfo(mockTradingApi, '0xABC', 'ETH', 10, 2700, 3300);

        expect(result.suggestedMaxRounded).toBe(734);
    });

    it('passes accountAddress and symbol to the trading API', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 100,
            usdc: { available: 100, total: 100, hold: 0 },
            spotBalances: {},
            spotPositions: {},
        });
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50);

        await fetchBalanceInfo(mockTradingApi, '0xDEF', 'HYPE', 10, 40, 60);

        expect(mockTradingApi.getUserSpotState).toHaveBeenCalledWith('0xDEF');
        expect(mockTradingApi.getCurrentPrice).toHaveBeenCalledWith('HYPE');
    });
});
