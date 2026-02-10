import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logger } from '../logger/logger';
import { WebSocketClient } from '../websocket/websocket-client';
import {
    HyperliquidWsOrderStatus,
    HyperliquidWsUserEventsEvent,
    HyperliquidWsUserSubscription,
} from './types/hyperliquid-ws-user-event';
import { Config } from '../config/config.schema';

type OrderUpdateHandler = (status: HyperliquidWsOrderStatus) => void;

@Injectable()
export class HyperliquidWsClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = logger.child({ context: HyperliquidWsClient.name });
    private readonly wsClient: WebSocketClient;
    private readonly accountAddress: string;
    private orderUpdateHandlers: Set<OrderUpdateHandler> = new Set();

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

    onOrderUpdate(handler: OrderUpdateHandler): () => void {
        this.orderUpdateHandlers.add(handler);
        return () => this.orderUpdateHandlers.delete(handler);
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

            this.orderUpdateHandlers.forEach((handler) => {
                try {
                    handler(orderStatus);
                } catch (error) {
                    this.logger.error(
                        { error, oid: orderStatus.order.oid },
                        'Error in order update handler',
                    );
                }
            });
        }
    }
}
