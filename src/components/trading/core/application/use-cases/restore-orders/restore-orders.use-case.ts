import { Inject, Injectable } from '@nestjs/common';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { OrderRestoreService } from '@components/trading/core/application/services/order-restore/order-restore.service';
import { logger } from '@/infra/logger/logger';
import { RestoreResult } from './restore-result';

/**
 * Use case for restoring orders that were placed on exchange but not updated in DB
 *
 * This handles the scenario where:
 * 1. Order was sent to exchange successfully
 * 2. Bot crashed/restarted before updating DB with exchangeOrderId
 * 3. Order remains in DB with status=Pending and no exchangeOrderId
 *
 * The use case:
 * - Fetches all open orders from exchange
 * - Uses OrderRestoreService to match and restore pending orders
 */
@Injectable()
export class RestoreOrdersUseCase {
    private readonly logger = logger.child({ context: RestoreOrdersUseCase.name });

    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        private readonly orderRestoreService: OrderRestoreService,
    ) {}

    async execute(accountAddress: string): Promise<RestoreResult> {
        const result = new RestoreResult();

        try {
            this.logger.debug('Starting order restore');

            // Fetch all open orders from exchange
            const allOpenOrders = await this.exchange.getOpenSpotOrders(accountAddress);

            // Restore orders
            const restoredCount = await this.orderRestoreService.restoreOrders(allOpenOrders);

            result.restored = restoredCount;

            if (restoredCount > 0) {
                this.logger.info({ restoredCount }, 'Order restore completed');
            } else {
                this.logger.debug('No orders to restore');
            }

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error({ error }, 'Failed to restore orders');
            result.errors.push(`Restore failed: ${errorMessage}`);
            return result;
        }
    }
}
