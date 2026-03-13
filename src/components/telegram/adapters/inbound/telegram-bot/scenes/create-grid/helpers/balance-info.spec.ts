import { describe, it, expect, vi, beforeEach } from 'vitest';
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

        const result = await fetchBalanceInfo(mockTradingApi, '0xABC', 'BTC');

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

        const result = await fetchBalanceInfo(mockTradingApi, '0xABC', 'ETH');

        expect(result.baseBalance.toNumber()).toBe(0);
        expect(result.baseInUsdc.toNumber()).toBe(0);
        expect(result.totalBalance.toNumber()).toBe(500);
    });

    it('calculates suggestedMaxRounded as floor(min(usdc, baseInUsdc) * 2)', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 800,
            usdc: { available: 800, total: 800, hold: 0 },
            spotBalances: { SOL: 10 },
            spotPositions: {},
        });
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(100);

        const result = await fetchBalanceInfo(mockTradingApi, '0xABC', 'SOL');

        // baseInUsdc = 10 * 100 = 1000, min(800, 1000) = 800, 800 * 2 = 1600
        expect(result.suggestedMaxRounded).toBe(1600);
    });

    it('uses baseInUsdc when it is the smaller balance', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 5000,
            usdc: { available: 5000, total: 5000, hold: 0 },
            spotBalances: { HYPE: 100 },
            spotPositions: {},
        });
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(10);

        const result = await fetchBalanceInfo(mockTradingApi, '0xABC', 'HYPE');

        // baseInUsdc = 100 * 10 = 1000, min(5000, 1000) = 1000, 1000 * 2 = 2000
        expect(result.suggestedMaxRounded).toBe(2000);
    });

    it('floors suggestedMaxRounded when result is not integer', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 333.7,
            usdc: { available: 333.7, total: 333.7, hold: 0 },
            spotBalances: { ETH: 1 },
            spotPositions: {},
        });
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(3000);

        const result = await fetchBalanceInfo(mockTradingApi, '0xABC', 'ETH');

        // min(333.7, 3000) = 333.7, 333.7 * 2 = 667.4, floor = 667
        expect(result.suggestedMaxRounded).toBe(667);
    });

    it('passes accountAddress and symbol to the trading API', async () => {
        vi.mocked(mockTradingApi.getUserSpotState).mockResolvedValue({
            usdcBalance: 100,
            usdc: { available: 100, total: 100, hold: 0 },
            spotBalances: {},
            spotPositions: {},
        });
        vi.mocked(mockTradingApi.getCurrentPrice).mockResolvedValue(50);

        await fetchBalanceInfo(mockTradingApi, '0xDEF', 'HYPE');

        expect(mockTradingApi.getUserSpotState).toHaveBeenCalledWith('0xDEF');
        expect(mockTradingApi.getCurrentPrice).toHaveBeenCalledWith('HYPE');
    });
});
