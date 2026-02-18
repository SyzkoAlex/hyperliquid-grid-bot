import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateAndStartGridUseCase } from './create-and-start-grid.use-case';
import { GridMode } from '@domain/models/grid/grid-mode';
import { Price } from '@domain/models/primitives/price';
import { Decimal } from '../../../../../domain/models/primitives/decimal';

describe('CreateAndStartGridUseCase', () => {
    let useCase: CreateAndStartGridUseCase;
    let infoClient: any;
    let gridRepository: any;
    let capitalCalculator: any;
    let gridLevelsCalculator: any;
    let userBalanceExtractor: any;
    let orderPlacement: any;

    beforeEach(() => {
        infoClient = {
            getUserSpotState: vi.fn(),
            getCurrentPrice: vi.fn(),
        };

        gridRepository = {
            save: vi.fn(),
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
            infoClient,
            gridRepository,
            capitalCalculator,
            gridLevelsCalculator,
            userBalanceExtractor,
            orderPlacement,
        );
    });

    describe('execute', () => {
        it('should create and start grid successfully', async () => {
            // Arrange
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

            // Setup mocks
            infoClient.getUserSpotState.mockResolvedValue(userState);
            infoClient.getCurrentPrice.mockResolvedValue(currentPrice);
            userBalanceExtractor.extractBalances.mockReturnValue(balances);
            capitalCalculator.calculateDistribution.mockReturnValue(distribution);
            gridRepository.save.mockResolvedValue(undefined);
            gridLevelsCalculator.calculateLevelsWithSizes.mockReturnValue(levelsWithSizes);
            orderPlacement.placeGridOrders.mockResolvedValue(2);

            // Act
            const result = await useCase.execute(params);

            // Assert
            expect(result.grid.symbol.toString()).toBe('BTC');
            expect(result.grid.mode).toBe(GridMode.Neutral);
            expect(result.grid.levels).toBe(10);
            expect(result.grid.status).toBe('running'); // Grid should be started
            expect(result.investmentUSDC).toEqual(distribution.investmentUSDC);
            expect(result.investmentBase).toEqual(distribution.investmentBase);

            // Verify getUserState was called
            expect(infoClient.getUserSpotState).toHaveBeenCalledWith('0x123');

            // Verify balance extraction
            expect(userBalanceExtractor.extractBalances).toHaveBeenCalledWith(userState, 'BTC');

            // Verify capital calculation
            expect(capitalCalculator.calculateDistribution).toHaveBeenCalledWith({
                mode: GridMode.Neutral,
                totalInvestmentUSDC: 10000,
                usdcBalance: balances.usdcBalance,
                baseBalance: balances.baseBalance,
                currentPrice: currentPrice,
                lowerPrice: 45000,
                upperPrice: 55000,
            });

            // Verify grid was saved (called twice: after creation and after starting)
            expect(gridRepository.save).toHaveBeenCalledTimes(2);
            expect(gridRepository.save).toHaveBeenCalledWith(result.grid);

            // Verify current price was fetched early
            expect(infoClient.getCurrentPrice).toHaveBeenCalledWith(
                expect.objectContaining({ value: 'BTC' }),
            );

            // Verify levels calculation
            expect(gridLevelsCalculator.calculateLevelsWithSizes).toHaveBeenCalledWith(
                result.grid,
                currentPrice,
            );

            // Verify order placement service was called
            expect(orderPlacement.placeGridOrders).toHaveBeenCalledWith(
                result.grid,
                levelsWithSizes,
            );
        });

        it('should handle order placement failures gracefully', async () => {
            // Arrange
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

            // Setup mocks
            infoClient.getUserSpotState.mockResolvedValue(userState);
            infoClient.getCurrentPrice.mockResolvedValue(currentPrice);
            userBalanceExtractor.extractBalances.mockReturnValue(balances);
            capitalCalculator.calculateDistribution.mockReturnValue(distribution);
            gridRepository.save.mockResolvedValue(undefined);
            gridLevelsCalculator.calculateLevelsWithSizes.mockReturnValue(levelsWithSizes);
            orderPlacement.placeGridOrders.mockResolvedValue(1);

            // Act
            const result = await useCase.execute(params);

            // Assert
            expect(result.grid.symbol.toString()).toBe('ETH');
            expect(result.grid.mode).toBe(GridMode.Long);
            expect(result.grid.status).toBe('running');
            expect(orderPlacement.placeGridOrders).toHaveBeenCalledWith(
                result.grid,
                levelsWithSizes,
            );
        });

        it('should skip orders without exchange order ID', async () => {
            // Arrange
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

            // Setup mocks
            infoClient.getUserSpotState.mockResolvedValue(userState);
            infoClient.getCurrentPrice.mockResolvedValue(currentPrice);
            userBalanceExtractor.extractBalances.mockReturnValue(balances);
            capitalCalculator.calculateDistribution.mockReturnValue(distribution);
            gridRepository.save.mockResolvedValue(undefined);
            gridLevelsCalculator.calculateLevelsWithSizes.mockReturnValue(levelsWithSizes);
            orderPlacement.placeGridOrders.mockResolvedValue(0);

            // Act
            const result = await useCase.execute(params);

            // Assert
            expect(result.grid.symbol.toString()).toBe('SOL');
            expect(result.grid.mode).toBe(GridMode.Neutral);
            expect(result.grid.status).toBe('running');
            expect(orderPlacement.placeGridOrders).toHaveBeenCalledWith(
                result.grid,
                levelsWithSizes,
            );
        });
    });
});
