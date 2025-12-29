import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HyperliquidOrderClient } from '../../../secondary/client/hyperliquid/hyperliquid-order.client';
import { OrderRestoreService } from '../../services/order-restore/order-restore.service';
import { logger } from '../../../../../infra/logger/logger';
import { Config } from '../../../../../infra/config/config.schema';
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
    private readonly accountAddress: string;

    constructor(
        private readonly orderClient: HyperliquidOrderClient,
        private readonly orderRestoreService: OrderRestoreService,
        private readonly configService: ConfigService<Config, true>,
    ) {
        this.accountAddress = this.configService.get('hyperliquid', { infer: true }).accountAddress;
    }

    async execute(): Promise<RestoreResult> {
        const result = new RestoreResult();

        try {
            this.logger.debug('Starting order restore');

            // Fetch all open orders from exchange
            const allOpenOrders = await this.orderClient.getOpenSpotOrders(this.accountAddress);

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
