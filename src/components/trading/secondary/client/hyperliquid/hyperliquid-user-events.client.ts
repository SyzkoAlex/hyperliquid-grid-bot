import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logger } from '../../../../../infra/logger/logger';
import { WebSocketClient } from '../../../../../infra/websocket/websocket-client';
import {
    HyperliquidWsOrderStatus,
    HyperliquidWsUserEventsEvent,
    HyperliquidWsUserSubscription,
} from './types/hyperliquid-ws-user-event';
import { Config } from '../../../../../infra/config/config.schema';

type OrderStatusHandler = (status: HyperliquidWsOrderStatus) => void;

/**
 * Hyperliquid Order Updates WebSocket Client
 *
 * Secondary Adapter for real-time order status notifications.
 * Subscribes to "orderUpdates" channel for all order status changes.
 *
 * ## Status handling:
 * - open → order placed successfully
 * - filled → trigger grid refill logic
 * - canceled → remove order from active orders
 */
@Injectable()
export class HyperliquidUserEventsClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = logger.child({ context: HyperliquidUserEventsClient.name });
    private readonly wsClient: WebSocketClient;
    private readonly accountAddress: string;
    private orderStatusHandlers: Set<OrderStatusHandler> = new Set();

    constructor(configService: ConfigService<Config, true>) {
        const hyperliquidConfig = configService.get('hyperliquid', { infer: true });
        this.accountAddress = hyperliquidConfig.accountAddress;

        this.wsClient = new WebSocketClient({
            url: hyperliquidConfig.websocketUrl,
            maxReconnectAttempts: hyperliquidConfig.websocket.maxReconnectAttempts,
            baseReconnectDelay: hyperliquidConfig.websocket.baseReconnectDelay,
        });

        this.wsClient.onOpen(() => this.subscribeToOrderUpdates());
        this.wsClient.onMessage((message) => this.handleMessage(message));
    }

    onModuleInit(): void {
        this.wsClient.connect();
    }

    onModuleDestroy(): void {
        this.wsClient.disconnect();
    }

    onOrderStatus(handler: OrderStatusHandler): () => void {
        this.orderStatusHandlers.add(handler);
        return () => this.orderStatusHandlers.delete(handler);
    }

    isConnected(): boolean {
        return this.wsClient.isConnected();
    }

    private subscribeToOrderUpdates(): void {
        const subscription: HyperliquidWsUserSubscription = {
            method: 'subscribe',
            subscription: {
                type: 'orderUpdates',
                user: this.accountAddress,
            },
        };

        this.wsClient.send(subscription);
        this.logger.info({ user: this.accountAddress }, 'Subscribed to orderUpdates');
    }

    private handleMessage(message: any): void {
        this.logger.debug({ message }, 'WebSocket message received');

        if (message.channel === 'orderUpdates') {
            this.handleOrderUpdates(message as HyperliquidWsUserEventsEvent);
        }

        if (message.channel === 'subscriptionResponse') {
            this.logger.info({ message }, 'Subscription confirmed');
        }
    }

    private handleOrderUpdates(event: HyperliquidWsUserEventsEvent): void {
        this.logger.debug({ statusCount: event.data.length }, 'Received order updates');

        for (const orderStatus of event.data) {
            this.logger.debug(
                {
                    oid: orderStatus.order.oid,
                    status: orderStatus.status,
                    coin: orderStatus.order.coin,
                },
                'Order status update',
            );

            this.orderStatusHandlers.forEach((handler) => {
                try {
                    handler(orderStatus);
                } catch (error) {
                    this.logger.error(
                        { error, oid: orderStatus.order.oid },
                        'Error in order status handler',
                    );
                }
            });
        }
    }
}
