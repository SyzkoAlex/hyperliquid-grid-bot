import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateAndStartGridUseCase } from './create-and-start-grid.use-case';
import { GridMode } from '@domain/models/grid/grid-mode';
import { GridStatus } from '@domain/models/grid/grid-status';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '@domain/models/primitives/decimal';
import { GridDto } from '@components/grids/api/dto/grid.dto';

describe('CreateAndStartGridUseCase', () => {
    let useCase: CreateAndStartGridUseCase;
    let exchange: any;
    let grids: any;
    let capitalCalculator: any;
    let gridLevelsCalculator: any;
    let userBalanceExtractor: any;
    let orderPlacement: any;

    const makeGridDto = (overrides: Partial<GridDto> = {}): GridDto => ({
        id: '550e8400-e29b-41d4-a716-446655440000',
        symbol: 'BTC',
        mode: GridMode.Neutral,
        status: GridStatus.Idle,
        lowerPrice: 45000,
        upperPrice: 55000,
        levels: 10,
        investmentUSDC: 5000,
        investmentBase: 0.1,
        trailingEnabled: false,
        trailingTriggerPercent: 5,
        trailingStepPercent: 2,
        trailingPartialClosePercent: 50,
        ...overrides,
    });

    beforeEach(() => {
        exchange = {
            getUserSpotState: vi.fn(),
            getCurrentPrice: vi.fn(),
        };

        grids = {
            createGrid: vi.fn(),
            updateGridStatus: vi.fn(),
        };

        capitalCalculator = {
            calculateDistribution: vi.fn(),
        };

        gridLevelsCalculator = {
            calculateLevelsWithSizes: vi.fn(),
        };

        userBalanceExtractor = {
            extractBalances: vi.fn(),
        };

        orderPlacement = {
            placeGridOrders: vi.fn(),
        };

        useCase = new CreateAndStartGridUseCase(
            exchange,
            grids,
            capitalCalculator,
            gridLevelsCalculator,
            userBalanceExtractor,
            orderPlacement,
        );
    });

    describe('execute', () => {
        it('should create and start grid successfully', async () => {
            const params = {
                chatId: 123456,
                address: '0x123',
                symbol: 'BTC',
                mode: GridMode.Neutral,
                lowerPrice: 45000,
                upperPrice: 55000,
                levels: 10,
                totalInvestmentUSDC: 10000,
                trailingEnabled: false,
            };

            const userState = {
                withdrawable: '10000',
                assetPositions: [{ position: { coin: 'BTC', szi: '0.2' } }],
            };

            const balances = {
                usdcBalance: Decimal.from(10000),
                baseBalance: Decimal.from(0.2),
            };

            const distribution = {
                investmentUSDC: Decimal.from(5000),
                investmentBase: Decimal.from(0.1),
            };

            const currentPrice = Price.from(50000);

            const levelsWithSizes = [
                {
                    index: 0,
                    price: Price.from(45000),
                    side: 'buy',
                    amountUSDC: 2500,
                    amountBase: 0.0555,
                },
                {
                    index: 1,
                    price: Price.from(55000),
                    side: 'sell',
                    amountUSDC: 5500,
                    amountBase: 0.1,
                },
            ];

            const gridDto = makeGridDto();

            exchange.getUserSpotState.mockResolvedValue(userState);
            exchange.getCurrentPrice.mockResolvedValue(currentPrice);
            userBalanceExtractor.extractBalances.mockReturnValue(balances);
            capitalCalculator.calculateDistribution.mockReturnValue(distribution);
            grids.createGrid.mockResolvedValue(gridDto);
            grids.updateGridStatus.mockResolvedValue(undefined);
            gridLevelsCalculator.calculateLevelsWithSizes.mockReturnValue(levelsWithSizes);
            orderPlacement.placeGridOrders.mockResolvedValue(2);

            const result = await useCase.execute(params);

            expect(result.grid.symbol).toBe('BTC');
            expect(result.grid.mode).toBe(GridMode.Neutral);
            expect(result.grid.levels).toBe(10);
            expect(result.investmentUSDC).toEqual(distribution.investmentUSDC);
            expect(result.investmentBase).toEqual(distribution.investmentBase);

            expect(exchange.getUserSpotState).toHaveBeenCalledWith('0x123');
            expect(userBalanceExtractor.extractBalances).toHaveBeenCalledWith(userState, 'BTC');

            expect(capitalCalculator.calculateDistribution).toHaveBeenCalledWith({
                mode: GridMode.Neutral,
                totalInvestmentUSDC: 10000,
                usdcBalance: balances.usdcBalance,
                baseBalance: balances.baseBalance,
                currentPrice: currentPrice,
                lowerPrice: 45000,
                upperPrice: 55000,
            });

            expect(grids.createGrid).toHaveBeenCalledTimes(1);
            expect(grids.updateGridStatus).toHaveBeenCalledWith(gridDto.id, GridStatus.Running);

            expect(exchange.getCurrentPrice).toHaveBeenCalledWith(
                expect.objectContaining({ value: 'BTC' }),
            );

            expect(gridLevelsCalculator.calculateLevelsWithSizes).toHaveBeenCalledWith(
                gridDto.lowerPrice,
                gridDto.upperPrice,
                gridDto.levels,
                gridDto.investmentUSDC,
                gridDto.investmentBase,
                currentPrice,
            );

            expect(orderPlacement.placeGridOrders).toHaveBeenCalledWith(gridDto, levelsWithSizes);
        });

        it('should handle order placement failures gracefully', async () => {
            const params = {
                chatId: 123456,
                address: '0x123',
                symbol: 'ETH',
                mode: GridMode.Long,
                lowerPrice: 2500,
                upperPrice: 3500,
                levels: 5,
                totalInvestmentUSDC: 5000,
                trailingEnabled: false,
            };

            const userState = { withdrawable: '5000', assetPositions: [] };
            const balances = {
                usdcBalance: Decimal.from(5000),
                baseBalance: Decimal.from(1),
            };
            const distribution = {
                investmentUSDC: Decimal.from(3000),
                investmentBase: Decimal.from(0.5),
            };

            const currentPrice = Price.from(3000);

            const levelsWithSizes = [
                {
                    index: 0,
                    price: Price.from(2500),
                    side: 'buy',
                    amountUSDC: 1500,
                    amountBase: 0.6,
                },
                {
                    index: 1,
                    price: Price.from(3000),
                    side: 'buy',
                    amountUSDC: 1500,
                    amountBase: 0.5,
                },
            ];

            const gridDto = makeGridDto({ symbol: 'ETH', mode: GridMode.Long, levels: 5 });

            exchange.getUserSpotState.mockResolvedValue(userState);
            exchange.getCurrentPrice.mockResolvedValue(currentPrice);
            userBalanceExtractor.extractBalances.mockReturnValue(balances);
            capitalCalculator.calculateDistribution.mockReturnValue(distribution);
            grids.createGrid.mockResolvedValue(gridDto);
            grids.updateGridStatus.mockResolvedValue(undefined);
            gridLevelsCalculator.calculateLevelsWithSizes.mockReturnValue(levelsWithSizes);
            orderPlacement.placeGridOrders.mockResolvedValue(1);

            const result = await useCase.execute(params);

            expect(result.grid.symbol).toBe('ETH');
            expect(result.grid.mode).toBe(GridMode.Long);
            expect(orderPlacement.placeGridOrders).toHaveBeenCalledWith(gridDto, levelsWithSizes);
        });

        it('should throw when base token balance is zero', async () => {
            const params = {
                chatId: 123456,
                address: '0x123',
                symbol: 'BTC',
                mode: GridMode.Neutral,
                lowerPrice: 45000,
                upperPrice: 55000,
                levels: 10,
                totalInvestmentUSDC: 10000,
                trailingEnabled: false,
            };

            exchange.getUserSpotState.mockResolvedValue({});
            exchange.getCurrentPrice.mockResolvedValue(Price.from(50000));
            userBalanceExtractor.extractBalances.mockReturnValue({
                usdcBalance: Decimal.from(10000),
                baseBalance: Decimal.from(0),
            });

            await expect(useCase.execute(params)).rejects.toThrow(
                'Cannot create grid: zero BTC balance',
            );
            expect(capitalCalculator.calculateDistribution).not.toHaveBeenCalled();
        });

        it('should throw when USDC balance is zero', async () => {
            const params = {
                chatId: 123456,
                address: '0x123',
                symbol: 'BTC',
                mode: GridMode.Neutral,
                lowerPrice: 45000,
                upperPrice: 55000,
                levels: 10,
                totalInvestmentUSDC: 10000,
                trailingEnabled: false,
            };

            exchange.getUserSpotState.mockResolvedValue({});
            exchange.getCurrentPrice.mockResolvedValue(Price.from(50000));
            userBalanceExtractor.extractBalances.mockReturnValue({
                usdcBalance: Decimal.from(0),
                baseBalance: Decimal.from(0.5),
            });

            await expect(useCase.execute(params)).rejects.toThrow(
                'Cannot create grid: zero USDC balance',
            );
            expect(capitalCalculator.calculateDistribution).not.toHaveBeenCalled();
        });

        it('should skip orders without exchange order ID', async () => {
            const params = {
                chatId: 123456,
                address: '0x123',
                symbol: 'SOL',
                mode: GridMode.Neutral,
                lowerPrice: 100,
                upperPrice: 150,
                levels: 5,
                totalInvestmentUSDC: 3000,
                trailingEnabled: false,
            };

            const userState = { withdrawable: '3000', assetPositions: [] };
            const balances = {
                usdcBalance: Decimal.from(3000),
                baseBalance: Decimal.from(15),
            };
            const distribution = {
                investmentUSDC: Decimal.from(1500),
                investmentBase: Decimal.from(10),
            };

            const currentPrice = Price.from(125);

            const levelsWithSizes = [
                {
                    index: 0,
                    price: Price.from(100),
                    side: 'buy',
                    amountUSDC: 1500,
                    amountBase: 15,
                },
            ];

            const gridDto = makeGridDto({ symbol: 'SOL', levels: 5 });

            exchange.getUserSpotState.mockResolvedValue(userState);
            exchange.getCurrentPrice.mockResolvedValue(currentPrice);
            userBalanceExtractor.extractBalances.mockReturnValue(balances);
            capitalCalculator.calculateDistribution.mockReturnValue(distribution);
            grids.createGrid.mockResolvedValue(gridDto);
            grids.updateGridStatus.mockResolvedValue(undefined);
            gridLevelsCalculator.calculateLevelsWithSizes.mockReturnValue(levelsWithSizes);
            orderPlacement.placeGridOrders.mockResolvedValue(0);

            const result = await useCase.execute(params);

            expect(result.grid.symbol).toBe('SOL');
            expect(result.grid.mode).toBe(GridMode.Neutral);
            expect(orderPlacement.placeGridOrders).toHaveBeenCalledWith(gridDto, levelsWithSizes);
        });
    });
});
