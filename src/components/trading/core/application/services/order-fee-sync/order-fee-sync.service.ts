import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logger } from '@/infra/logger/logger';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { Config } from '@/config/config.schema';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';

@Injectable()
export class OrderFeeSyncService {
    private readonly logger = logger.child({ context: OrderFeeSyncService.name });
    private readonly accountAddress: string;

    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        private readonly configService: ConfigService<Config, true>,
    ) {
        this.accountAddress = this.configService.get('hyperliquid', { infer: true }).accountAddress;
    }

    async syncFee(orderId: string, exchangeOrderId: string, fillTimestamp: number): Promise<void> {
        try {
            const oid = Number(exchangeOrderId);
            const fills = await this.exchange.getOrderFills(
                this.accountAddress,
                oid,
                fillTimestamp - 5_000,
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
