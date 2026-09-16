import { Inject, Injectable } from '@nestjs/common';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { OrderRestoreService } from '@components/trading/core/application/services/order-restore/order-restore.service';
import { LeftoverOrderSweepService } from '@components/trading/core/application/services/leftover-order-sweep/leftover-order-sweep.service';
import { logger } from '@/infra/logger/logger';
import { RestoreResult } from './restore-result';

/**
 * Use case for reconciling the DB order state with the exchange.
 *
 * Restores orders that were placed on exchange but not updated in DB — the scenario where:
 * 1. Order was sent to exchange successfully
 * 2. Bot crashed/restarted before updating DB with exchangeOrderId
 * 3. Order remains in DB with status=Pending and no exchangeOrderId
 *
 * It then sweeps the opposite leak: orders still active in the DB whose grid is no longer running,
 * left behind by a stop interrupted after the grid was marked stopped (see
 * LeftoverOrderSweepService). Both passes run independently — a failing exchange read must not
 * skip the sweep.
 */
@Injectable()
export class RestoreOrdersUseCase {
    private readonly logger = logger.child({ context: RestoreOrdersUseCase.name });

    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        private readonly orderRestoreService: OrderRestoreService,
        private readonly leftoverOrderSweep: LeftoverOrderSweepService,
    ) {}

    async execute(accountAddress: string, userId: string): Promise<RestoreResult> {
        const result = new RestoreResult();

        await this.restorePendingOrders(result, accountAddress);
        await this.sweepLeftoverOrders(result, accountAddress, userId);

        return result;
    }

    private async restorePendingOrders(
        result: RestoreResult,
        accountAddress: string,
    ): Promise<void> {
        try {
            this.logger.debug('Starting order restore');

            const allOpenOrders = await this.exchange.getOpenSpotOrders(accountAddress);
            result.restored = await this.orderRestoreService.restoreOrders(allOpenOrders);

            if (result.restored > 0) {
                this.logger.info({ restoredCount: result.restored }, 'Order restore completed');
            } else {
                this.logger.debug('No orders to restore');
            }
        } catch (err) {
            this.logger.error({ err }, 'Failed to restore orders');
            result.errors.push(`Restore failed: ${this.toErrorMessage(err)}`);
        }
    }

    private async sweepLeftoverOrders(
        result: RestoreResult,
        accountAddress: string,
        userId: string,
    ): Promise<void> {
        try {
            const cancelledCount = await this.leftoverOrderSweep.sweep(accountAddress, userId);

            if (cancelledCount > 0) {
                this.logger.info(
                    { cancelledCount },
                    'Leftover orders of grids that are no longer running cancelled',
                );
            }
        } catch (err) {
            this.logger.error({ err }, 'Failed to sweep leftover orders');
            result.errors.push(`Leftover sweep failed: ${this.toErrorMessage(err)}`);
        }
    }

    private toErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
