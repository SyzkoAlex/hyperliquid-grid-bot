import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { logger } from '@infra/logger/logger';
import { OrderEventsListener } from '@components/trading/infra/adapters/outbound/exchange/hyperliquid/order-events.listener';
import { ProcessOrderStatusUseCase } from '@components/trading/application/use-cases/process-order-status/process-order-status.use-case';
import { HyperliquidWsOrderStatus } from '@infra/hyperliquid/types/hyperliquid-ws-user-event';

/**
 * Orders WebSocket Controller
 *
 * Controller that listens for order status changes via WebSocket.
 * This provides faster order detection (100-200ms) compared to polling (10s).
 *
 * ## Subscriptions:
 * - userEvents: Order status changes (filled, canceled, rejected)
 *
 * ## Event handling:
 * - filled (status) → trigger grid refill logic
 * - canceled → remove order from active orders
 */
@Injectable()
export class OrdersWebsocketController implements OnModuleInit, OnModuleDestroy {
    private readonly logger = logger.child({ context: OrdersWebsocketController.name });
    private unsubscribeStatus?: () => void;

    constructor(
        private readonly orderEventsAdapter: OrderEventsListener,
        private readonly processOrderStatus: ProcessOrderStatusUseCase,
    ) {}

    onModuleInit(): void {
        this.unsubscribeStatus = this.orderEventsAdapter.onOrderStatus((status) =>
            this.handleOrderStatus(status),
        );

        this.logger.info('Orders WebSocket controller initialized');
    }

    onModuleDestroy(): void {
        if (this.unsubscribeStatus) {
            this.unsubscribeStatus();
        }
        this.logger.info('Orders WebSocket controller destroyed');
    }

    private async handleOrderStatus(orderStatus: HyperliquidWsOrderStatus): Promise<void> {
        try {
            const result = await this.processOrderStatus.execute({ orderStatus });

            if (result.isGridOrder) {
                this.logger.info(
                    {
                        oid: orderStatus.order.oid,
                        status: orderStatus.status,
                        coin: orderStatus.order.coin,
                        success: result.success,
                    },
                    'Order status event processed',
                );
            }
        } catch (error) {
            this.logger.error(
                { error, oid: orderStatus.order.oid },
                'Error processing order status event',
            );
        }
    }
}
