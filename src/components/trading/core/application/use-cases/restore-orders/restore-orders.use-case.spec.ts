import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RestoreOrdersUseCase } from './restore-orders.use-case';
import { ExchangePort } from '@components/trading/core/application/ports/exchange.port';
import { OrderRestoreService } from '@components/trading/core/application/services/order-restore/order-restore.service';
import { LeftoverOrderSweepService } from '@components/trading/core/application/services/leftover-order-sweep/leftover-order-sweep.service';

const ACCOUNT_ADDRESS = '0x123';
const USER_ID = 'user-1';

describe('RestoreOrdersUseCase', () => {
    let useCase: RestoreOrdersUseCase;
    let mockExchange: { getOpenSpotOrders: ReturnType<typeof vi.fn> };
    let mockOrderRestoreService: { restoreOrders: ReturnType<typeof vi.fn> };
    let mockLeftoverOrderSweep: { sweep: ReturnType<typeof vi.fn> };

    const execute = () => useCase.execute(ACCOUNT_ADDRESS, USER_ID);

    beforeEach(() => {
        mockExchange = { getOpenSpotOrders: vi.fn().mockResolvedValue([]) };
        mockOrderRestoreService = { restoreOrders: vi.fn().mockResolvedValue(0) };
        mockLeftoverOrderSweep = { sweep: vi.fn().mockResolvedValue(0) };

        useCase = new RestoreOrdersUseCase(
            mockExchange as unknown as ExchangePort,
            mockOrderRestoreService as unknown as OrderRestoreService,
            mockLeftoverOrderSweep as unknown as LeftoverOrderSweepService,
        );
    });

    describe('execute', () => {
        it('should restore orders successfully', async () => {
            mockExchange.getOpenSpotOrders.mockResolvedValue([
                { exchangeOrderId: 'oid1', cloid: 'cloid1' },
            ]);
            mockOrderRestoreService.restoreOrders.mockResolvedValue(1);

            const result = await execute();

            expect(result.restored).toBe(1);
            expect(result.hasErrors).toBe(false);
            expect(mockExchange.getOpenSpotOrders).toHaveBeenCalledWith(ACCOUNT_ADDRESS);
            expect(mockOrderRestoreService.restoreOrders).toHaveBeenCalled();
        });

        it('should return zero when no orders to restore', async () => {
            const result = await execute();

            expect(result.restored).toBe(0);
            expect(result.hasErrors).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            mockExchange.getOpenSpotOrders.mockRejectedValue(new Error('Network error'));

            const result = await execute();

            expect(result.restored).toBe(0);
            expect(result.hasErrors).toBe(true);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Network error');
        });

        it('sweeps the leftover orders of the user', async () => {
            mockLeftoverOrderSweep.sweep.mockResolvedValue(2);

            const result = await execute();

            expect(mockLeftoverOrderSweep.sweep).toHaveBeenCalledWith(USER_ID, ACCOUNT_ADDRESS);
            expect(result.hasErrors).toBe(false);
        });

        it('sweeps the leftover orders even when the restore pass fails', async () => {
            mockExchange.getOpenSpotOrders.mockRejectedValue(new Error('Network error'));

            await execute();

            expect(mockLeftoverOrderSweep.sweep).toHaveBeenCalledOnce();
        });

        it('reports a failing sweep without losing the restore result', async () => {
            mockOrderRestoreService.restoreOrders.mockResolvedValue(1);
            mockLeftoverOrderSweep.sweep.mockRejectedValue(new Error('db unavailable'));

            const result = await execute();

            expect(result.restored).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('db unavailable');
        });
    });
});
