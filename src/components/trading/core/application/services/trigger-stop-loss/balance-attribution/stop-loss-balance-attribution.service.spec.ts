import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StopLossBalanceAttributionService } from './stop-loss-balance-attribution.service';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderSide } from '@domain/models/order/order-side';
import { Decimal } from '@domain/models/primitives/decimal';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { UserState } from '@components/trading/core/domain/models/user-state/user-state';
import { AssetPosition } from '@components/trading/core/domain/models/user-state/asset-position';

const makeGrid = (investmentBase: number = 0.5) => ({
    id: 'grid-1',
    symbol: 'ETH',
    investmentBase,
    investmentUSDC: 1000,
});

const makeOrder = (side: OrderSide, amount: number, status: OrderStatus) => ({
    id: `order-${Math.random()}`,
    gridId: 'grid-1',
    symbol: 'ETH',
    side,
    status,
    type: 'limit' as const,
    levelIndex: 0,
    price: 2000,
    amount,
    exchangeOrderId: 'ex-1',
    createdAt: Date.now(),
});

const makeUserState = (ethAmount: number) =>
    UserState.create({
        withdrawableBalance: Decimal.from(1000),
        assetPositions: [
            AssetPosition.create({
                symbol: TradingSymbol.create('ETH'),
                size: Decimal.from(ethAmount),
            }),
        ],
    });

describe('StopLossBalanceAttributionService', () => {
    let sut: StopLossBalanceAttributionService;
    let mockGrids: {
        findOrdersByGridId: ReturnType<typeof vi.fn>;
    };
    let mockExchange: {
        getUserSpotState: ReturnType<typeof vi.fn>;
    };
    let mockUserBalanceExtractor: {
        extractBalances: ReturnType<typeof vi.fn>;
    };

    const symbol = TradingSymbol.create('ETH');
    const accountAddress = '0xabc';

    beforeEach(() => {
        mockGrids = {
            findOrdersByGridId: vi.fn().mockResolvedValue([]),
        };
        mockExchange = {
            getUserSpotState: vi.fn().mockResolvedValue(makeUserState(0.5)),
        };
        mockUserBalanceExtractor = {
            extractBalances: vi.fn().mockReturnValue({
                usdcBalance: Decimal.from(1000),
                baseBalance: Decimal.from(0.5),
            }),
        };

        sut = new StopLossBalanceAttributionService(
            mockGrids as any,
            mockExchange as any,
            mockUserBalanceExtractor as any,
        );
    });

    describe('computeSellAmount', () => {
        it('returns initialBaseAmount when no orders have been filled', async () => {
            const grid = makeGrid(0.5);

            const result = await sut.computeSellAmount(
                'grid-1',
                grid as any,
                accountAddress,
                symbol,
            );

            expect(result.toNumber()).toBe(0.5);
        });

        it('adds filled buy qty to initial base', async () => {
            mockGrids.findOrdersByGridId.mockResolvedValue([
                makeOrder(OrderSide.Buy, 0.1, OrderStatus.Filled),
            ]);
            mockUserBalanceExtractor.extractBalances.mockReturnValue({
                usdcBalance: Decimal.from(1000),
                baseBalance: Decimal.from(0.6),
            });
            const grid = makeGrid(0.5);

            const result = await sut.computeSellAmount(
                'grid-1',
                grid as any,
                accountAddress,
                symbol,
            );

            expect(result.toNumber()).toBeCloseTo(0.6);
        });

        it('subtracts filled sell qty from initial base', async () => {
            mockGrids.findOrdersByGridId.mockResolvedValue([
                makeOrder(OrderSide.Sell, 0.2, OrderStatus.Filled),
            ]);
            mockUserBalanceExtractor.extractBalances.mockReturnValue({
                usdcBalance: Decimal.from(1000),
                baseBalance: Decimal.from(0.3),
            });
            const grid = makeGrid(0.5);

            const result = await sut.computeSellAmount(
                'grid-1',
                grid as any,
                accountAddress,
                symbol,
            );

            expect(result.toNumber()).toBeCloseTo(0.3);
        });

        it('clamps result to actual on-account balance when computed exceeds it', async () => {
            // investmentBase=1.0 but only 0.4 on account (e.g., tokens from another grid)
            mockUserBalanceExtractor.extractBalances.mockReturnValue({
                usdcBalance: Decimal.from(1000),
                baseBalance: Decimal.from(0.4),
            });
            const grid = makeGrid(1.0);

            const result = await sut.computeSellAmount(
                'grid-1',
                grid as any,
                accountAddress,
                symbol,
            );

            expect(result.toNumber()).toBe(0.4);
        });

        it('returns zero when computed amount is negative', async () => {
            // More sells than buys+initial (data inconsistency guard)
            mockGrids.findOrdersByGridId.mockResolvedValue([
                makeOrder(OrderSide.Sell, 1.0, OrderStatus.Filled),
            ]);
            const grid = makeGrid(0.5);

            const result = await sut.computeSellAmount(
                'grid-1',
                grid as any,
                accountAddress,
                symbol,
            );

            expect(result.toNumber()).toBe(0);
        });

        it('returns zero when on-account balance is zero', async () => {
            mockUserBalanceExtractor.extractBalances.mockReturnValue({
                usdcBalance: Decimal.from(1000),
                baseBalance: Decimal.zero(),
            });
            const grid = makeGrid(0.5);

            const result = await sut.computeSellAmount(
                'grid-1',
                grid as any,
                accountAddress,
                symbol,
            );

            expect(result.toNumber()).toBe(0);
        });

        it('ignores non-filled orders (Placed, Cancelled)', async () => {
            mockGrids.findOrdersByGridId.mockResolvedValue([
                makeOrder(OrderSide.Buy, 0.3, OrderStatus.Placed),
                makeOrder(OrderSide.Sell, 0.2, OrderStatus.Cancelled),
                makeOrder(OrderSide.Buy, 0.1, OrderStatus.Filled),
            ]);
            mockUserBalanceExtractor.extractBalances.mockReturnValue({
                usdcBalance: Decimal.from(1000),
                baseBalance: Decimal.from(0.6),
            });
            const grid = makeGrid(0.5);

            const result = await sut.computeSellAmount(
                'grid-1',
                grid as any,
                accountAddress,
                symbol,
            );

            // Only the 0.1 filled buy counts: 0.5 + 0.1 = 0.6
            expect(result.toNumber()).toBeCloseTo(0.6);
        });

        it('fetches user state from exchange with provided account address', async () => {
            const grid = makeGrid(0.5);

            await sut.computeSellAmount('grid-1', grid as any, '0xdeadbeef', symbol);

            expect(mockExchange.getUserSpotState).toHaveBeenCalledWith('0xdeadbeef');
        });

        it('subtracts other active grids investmentBase from baseBalance before clamping', async () => {
            // Two grids on ETH: current grid has investmentBase=0.5, other grid has investmentBase=0.3.
            // Total on-account: 0.8 ETH. Available for this grid = 0.8 - 0.3 = 0.5.
            mockUserBalanceExtractor.extractBalances.mockReturnValue({
                usdcBalance: Decimal.from(1000),
                baseBalance: Decimal.from(0.8),
            });
            const grid = makeGrid(0.5);
            const otherGrid = { id: 'grid-2', symbol: 'ETH', investmentBase: 0.3 };

            const result = await sut.computeSellAmount(
                'grid-1',
                grid as any,
                accountAddress,
                symbol,
                [grid as any, otherGrid as any],
            );

            // computed = 0.5 (no fills), available = 0.8 - 0.3 = 0.5 → clamped to min(0.5, 0.5)
            expect(result.toNumber()).toBeCloseTo(0.5);
        });

        it('returns zero when all baseBalance is reserved by other grids', async () => {
            // Only 0.3 ETH on account, other grid reserves 0.4 → available = 0
            mockUserBalanceExtractor.extractBalances.mockReturnValue({
                usdcBalance: Decimal.from(1000),
                baseBalance: Decimal.from(0.3),
            });
            const grid = makeGrid(0.5);
            const otherGrid = { id: 'grid-2', symbol: 'ETH', investmentBase: 0.4 };

            const result = await sut.computeSellAmount(
                'grid-1',
                grid as any,
                accountAddress,
                symbol,
                [grid as any, otherGrid as any],
            );

            expect(result.toNumber()).toBe(0);
        });
    });
});
