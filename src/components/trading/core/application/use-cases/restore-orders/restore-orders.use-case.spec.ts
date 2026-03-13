import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RestoreOrdersUseCase } from './restore-orders.use-case';

describe('RestoreOrdersUseCase', () => {
    let useCase: RestoreOrdersUseCase;
    let mockOrderClient: any;
    let mockOrderRestoreService: any;
    let mockConfigService: any;

    beforeEach(() => {
        mockOrderClient = {
            getOpenSpotOrders: vi.fn().mockResolvedValue([]),
        };

        mockOrderRestoreService = {
            restoreOrders: vi.fn().mockResolvedValue(0),
        };

        mockConfigService = {
            get: vi.fn().mockReturnValue({ accountAddress: '0x123' }),
        };

        useCase = new RestoreOrdersUseCase(
            mockOrderClient,
            mockOrderRestoreService,
            mockConfigService,
        );
    });

    describe('execute', () => {
        it('should restore orders successfully', async () => {
            mockOrderClient.getOpenSpotOrders.mockResolvedValue([
                { exchangeOrderId: 'oid1', cloid: 'cloid1' },
            ]);
            mockOrderRestoreService.restoreOrders.mockResolvedValue(1);

            const result = await useCase.execute();

            expect(result.restored).toBe(1);
            expect(result.hasErrors).toBe(false);
            expect(mockOrderClient.getOpenSpotOrders).toHaveBeenCalledWith('0x123');
            expect(mockOrderRestoreService.restoreOrders).toHaveBeenCalled();
        });

        it('should return zero when no orders to restore', async () => {
            mockOrderClient.getOpenSpotOrders.mockResolvedValue([]);
            mockOrderRestoreService.restoreOrders.mockResolvedValue(0);

            const result = await useCase.execute();

            expect(result.restored).toBe(0);
            expect(result.hasErrors).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            mockOrderClient.getOpenSpotOrders.mockRejectedValue(new Error('Network error'));

            const result = await useCase.execute();

            expect(result.restored).toBe(0);
            expect(result.hasErrors).toBe(true);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Network error');
        });
    });
});
