import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildEligibleSwapOffer } from './build-eligible-swap-offer';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { SwapSide } from '@components/trading/api/dto/optimal-swap.dto';

type TradingApiMock = {
    calculateOptimalSwap: ReturnType<typeof vi.fn>;
    getMinOrderNotional: ReturnType<typeof vi.fn>;
};

const BASE_PARAMS = {
    symbol: 'HYPE',
    usdcBalance: 1000,
    baseBalance: 50,
    currentPrice: 20,
    lowerPrice: 15,
    upperPrice: 25,
    levels: 10,
};

const MIN_ORDER_NOTIONAL = 10;

describe('buildEligibleSwapOffer', () => {
    let mockTradingApi: TradingApiMock;

    beforeEach(() => {
        mockTradingApi = {
            calculateOptimalSwap: vi.fn(),
            getMinOrderNotional: vi.fn().mockReturnValue(MIN_ORDER_NOTIONAL),
        };
    });

    it('returns null when calculateOptimalSwap returns null', () => {
        mockTradingApi.calculateOptimalSwap.mockReturnValue(null);

        const result = buildEligibleSwapOffer(
            mockTradingApi as unknown as TradingApiPort,
            BASE_PARAMS,
        );

        expect(result).toBeNull();
    });

    it('returns null when swap amount is below minOrderNotional', () => {
        mockTradingApi.calculateOptimalSwap.mockReturnValue({
            side: SwapSide.UsdcToBase,
            amountUsdc: MIN_ORDER_NOTIONAL - 1,
            expectedReceived: 0.4,
        });

        const result = buildEligibleSwapOffer(
            mockTradingApi as unknown as TradingApiPort,
            BASE_PARAMS,
        );

        expect(result).toBeNull();
    });

    it('returns the swap offer when amount equals minOrderNotional (boundary)', () => {
        const offer = {
            side: SwapSide.UsdcToBase,
            amountUsdc: MIN_ORDER_NOTIONAL,
            expectedReceived: 0.5,
        };
        mockTradingApi.calculateOptimalSwap.mockReturnValue(offer);

        const result = buildEligibleSwapOffer(
            mockTradingApi as unknown as TradingApiPort,
            BASE_PARAMS,
        );

        expect(result).toEqual(offer);
    });

    it('returns the swap offer when amount is above minOrderNotional', () => {
        const offer = {
            side: SwapSide.BaseToUsdc,
            amountUsdc: 100,
            expectedReceived: 100,
        };
        mockTradingApi.calculateOptimalSwap.mockReturnValue(offer);

        const result = buildEligibleSwapOffer(
            mockTradingApi as unknown as TradingApiPort,
            BASE_PARAMS,
        );

        expect(result).toEqual(offer);
    });

    it('passes all params to calculateOptimalSwap', () => {
        mockTradingApi.calculateOptimalSwap.mockReturnValue(null);

        buildEligibleSwapOffer(mockTradingApi as unknown as TradingApiPort, BASE_PARAMS);

        expect(mockTradingApi.calculateOptimalSwap).toHaveBeenCalledWith(BASE_PARAMS);
    });
});
