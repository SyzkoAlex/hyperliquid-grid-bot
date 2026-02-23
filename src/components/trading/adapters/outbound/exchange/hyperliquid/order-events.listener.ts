import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { HyperliquidWsClient } from '@adapters/inbound/hyperliqued/hyperliquid-ws.client';
import { HyperliquidWsOrderStatus } from '@/infra/hyperliqued/types/hyperliquid-ws-user-event';

type OrderStatusHandler = (status: HyperliquidWsOrderStatus) => void;

@Injectable()
export class OrderEventsListener implements OnModuleInit, OnModuleDestroy {
    private readonly logger = logger.child({ context: OrderEventsListener.name });
    private orderStatusHandlers: Set<OrderStatusHandler> = new Set();
    private unsubscribe?: () => void;

    constructor(private readonly wsClient: HyperliquidWsClient) {}

    onModuleInit(): void {
        this.unsubscribe = this.wsClient.onOrderUpdate((status) => {
            this.orderStatusHandlers.forEach((handler) => {
                try {
                    handler(status);
                } catch (error) {
                    this.logger.error(
                        { error, oid: status.order.oid },
                        'Error in order status handler',
                    );
                }
            });
        });
    }

    onModuleDestroy(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    onOrderStatus(handler: OrderStatusHandler): () => void {
        this.orderStatusHandlers.add(handler);
        return () => this.orderStatusHandlers.delete(handler);
    }

    isConnected(): boolean {
        return this.wsClient.isConnected();
    }
}
