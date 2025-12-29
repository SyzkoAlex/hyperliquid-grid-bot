import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncOrdersUseCase } from './sync-orders.use-case';
import { GridMode } from '../../domain/grid/grid-mode';
import { Grid } from '../../domain/grid/grid';
import { Symbol } from '../../domain/common/symbol';
import { Price } from '../../domain/common/price';
import { Decimal } from '../../../../../domain/primitives/decimal';

describe('SyncOrdersUseCase', () => {
    let useCase: SyncOrdersUseCase;
    let mockOrderClient: any;
    let mockGridRepository: any;
    let mockGridProcessorService: any;
    let mockConfigService: any;

    const createTestGrid = () => {
        return Grid.create({
            symbol: Symbol.create('BTC'),
            mode: GridMode.Neutral,
            lowerPrice: Price.from(45000),
            upperPrice: Price.from(55000),
            levels: 11,
            investmentUSDC: Decimal.from(5000),
            investmentBase: Decimal.from(0.1),
        });
    };

    beforeEach(() => {
        mockOrderClient = {
            getOpenSpotOrders: vi.fn().mockResolvedValue([]),
        };

        mockGridRepository = {
            findManyActive: vi.fn().mockResolvedValue([]),
        };

        mockGridProcessorService = {
            process: vi.fn().mockResolvedValue({ fills: 0, refills: 0 }),
        };

        mockConfigService = {
            get: vi.fn().mockReturnValue({ accountAddress: '0x123' }),
        };

        useCase = new SyncOrdersUseCase(
            mockConfigService,
            mockOrderClient,
            mockGridRepository,
            mockGridProcessorService,
        );
    });

    describe('execute', () => {
        it('should return empty result when no active grids', async () => {
            mockGridRepository.findManyActive.mockResolvedValue([]);

            const result = await useCase.execute();

            expect(result.gridsProcessed).toBe(0);
            expect(result.fillsDetected).toBe(0);
            expect(mockOrderClient.getOpenSpotOrders).not.toHaveBeenCalled();
        });

        it('should process active grids and detect fills', async () => {
            const grid = createTestGrid();
            grid.start();

            mockGridRepository.findManyActive.mockResolvedValue([grid]);
            mockGridProcessorService.process.mockResolvedValue({
                fills: 1,
                refills: 1,
            });

            const result = await useCase.execute();

            expect(result.gridsProcessed).toBe(1);
            expect(result.fillsDetected).toBe(1);
            expect(result.refillsPlaced).toBe(1);
            expect(mockGridProcessorService.process).toHaveBeenCalledWith(grid, []);
        });

        it('should skip grids that are not running', async () => {
            const grid = createTestGrid();
            // Grid is in Idle state (not started)

            mockGridRepository.findManyActive.mockResolvedValue([grid]);

            const result = await useCase.execute();

            expect(result.gridsProcessed).toBe(1);
            expect(result.fillsDetected).toBe(0);
            expect(mockGridProcessorService.process).toHaveBeenCalledWith(grid, []);
        });

        it('should handle errors gracefully and continue processing', async () => {
            const grid1 = createTestGrid();
            const grid2 = createTestGrid();
            grid1.start();
            grid2.start();

            mockGridRepository.findManyActive.mockResolvedValue([grid1, grid2]);
            mockGridProcessorService.process
                .mockRejectedValueOnce(new Error('DB error'))
                .mockResolvedValueOnce({ fills: 0, refills: 0 });

            const result = await useCase.execute();

            expect(result.gridsProcessed).toBe(1); // Only second grid processed
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('DB error');
        });

        it('should count refills correctly', async () => {
            const grid = createTestGrid();
            grid.start();

            mockGridRepository.findManyActive.mockResolvedValue([grid]);
            mockGridProcessorService.process.mockResolvedValue({
                fills: 2,
                refills: 1, // Only one successful refill
            });

            const result = await useCase.execute();

            expect(result.fillsDetected).toBe(2);
            expect(result.refillsPlaced).toBe(1); // Only one successful
        });
    });
});
