import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';

const FILLS_LOOKUP_BUFFER_MS = 5_000;
const FILLS_LOOKUP_WINDOW_MS = 60_000;

@Injectable()
export class OrderFeeSyncService {
    private readonly logger = logger.child({ context: OrderFeeSyncService.name });

    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
    ) {}

    async syncFee(
        orderId: string,
        exchangeOrderId: string,
        fillTimestamp: number,
        accountAddress: string,
    ): Promise<void> {
        try {
            const oid = Number(exchangeOrderId);
            const startTime = fillTimestamp - FILLS_LOOKUP_BUFFER_MS;
            const fills = await this.exchange.getOrderFills(
                accountAddress,
                oid,
                startTime,
                startTime + FILLS_LOOKUP_WINDOW_MS,
            );

            if (fills.length === 0) {
                this.logger.warn({ orderId, oid }, 'No fills found for order, fee not recorded');
                return;
            }

            const totalFee = fills.reduce((sum, f) => sum + f.feeUsdc, 0);
            await this.grids.updateOrderFee(orderId, totalFee);

            this.logger.debug({ orderId, oid, totalFee }, 'Order fee recorded');
        } catch (error) {
            this.logger.warn({ err: error, orderId }, 'Failed to sync order fee');
        }
    }
}
