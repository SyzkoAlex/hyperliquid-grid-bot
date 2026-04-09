import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logger } from '@/infra/logger/logger';
import { WebSocketClient } from '@/infra/websocket/websocket-client';
import { OrderStatusUpdate } from '@components/trading/core/application/use-cases/process-order-status/order-status-update';
import { ProcessOrderStatusUseCase } from '@components/trading/core/application/use-cases/process-order-status/process-order-status.use-case';
import { Config } from '@/config/config.schema';

interface HyperliquidWsOrderStatus {
    order: {
        coin: string;
        oid: number;
        side: 'B' | 'A';
        limitPx: string;
        sz: string;
        timestamp: number;
    };
    status: string;
    statusTimestamp: number;
}

interface HyperliquidWsEvent {
    channel: string;
    data: HyperliquidWsOrderStatus[];
}

@Injectable()
export class OrdersWebsocketAdapter implements OnModuleInit, OnModuleDestroy {
    private readonly logger = logger.child({ context: OrdersWebsocketAdapter.name });
    private readonly wsClient: WebSocketClient;
    private readonly accountAddress: string;

    constructor(
        private readonly configService: ConfigService<Config, true>,
        private readonly processOrderStatus: ProcessOrderStatusUseCase,
    ) {
        const hyperliquidConfig = this.configService.get('hyperliquid', { infer: true });
        this.accountAddress = hyperliquidConfig.accountAddress;

        this.wsClient = new WebSocketClient({
            url: hyperliquidConfig.websocketUrl,
            maxReconnectAttempts: hyperliquidConfig.websocket.maxReconnectAttempts,
            baseReconnectDelay: hyperliquidConfig.websocket.baseReconnectDelay,
            keepAlive: {
                intervalMs: hyperliquidConfig.websocket.keepAliveIntervalMs,
                message: { method: 'ping' },
            },
        });

        this.wsClient.onOpen(() => this.subscribeToOrderUpdates());
        this.wsClient.onMessage((message) => this.handleMessage(message));
    }

    onModuleInit(): void {
        this.wsClient.connect();
        this.logger.info('Orders WebSocket adapter initialized');
    }

    onModuleDestroy(): void {
        this.wsClient.disconnect();
    }

    isConnected(): boolean {
        return this.wsClient.isConnected();
    }

    private subscribeToOrderUpdates(): void {
        this.wsClient.send({
            method: 'subscribe',
            subscription: { type: 'orderUpdates', user: this.accountAddress },
        });
        this.logger.info({ user: this.accountAddress }, 'Subscribed to orderUpdates');
    }

    private handleMessage(message: any): void {
        this.logger.debug({ message }, 'WebSocket message received');

        if (message.method === 'pong') {
            this.logger.trace('Received pong');
            return;
        }

        if (message.channel === 'orderUpdates') {
            this.handleOrderUpdates(message as HyperliquidWsEvent);
        }

        if (message.channel === 'subscriptionResponse') {
            this.logger.info({ message }, 'Subscription confirmed');
        }
    }

    private handleOrderUpdates(event: HyperliquidWsEvent): void {
        this.logger.debug({ statusCount: event.data.length }, 'Received order updates');

        for (const raw of event.data) {
            const update = this.toOrderStatusUpdate(raw);
            this.processUpdate(update);
        }
    }

    private async processUpdate(update: OrderStatusUpdate): Promise<void> {
        try {
            const result = await this.processOrderStatus.execute({ orderStatus: update });

            if (result.isGridOrder) {
                this.logger.info(
                    {
                        oid: update.exchangeOrderId,
                        status: update.status,
                        coin: update.coin,
                        success: result.success,
                    },
                    'Order status event processed',
                );
            }
        } catch (error) {
            this.logger.error(
                { error, oid: update.exchangeOrderId },
                'Error processing order status event',
            );
        }
    }

    private toOrderStatusUpdate(raw: HyperliquidWsOrderStatus): OrderStatusUpdate {
        return {
            exchangeOrderId: raw.order.oid,
            coin: raw.order.coin,
            status: raw.status,
            statusTimestamp: raw.statusTimestamp,
        };
    }
}
