import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logger } from '@/infra/logger/logger';
import { WebSocketClient } from '@/infra/websocket/websocket-client';
import { OrderStatusUpdate } from '@components/trading/core/application/use-cases/process-order-status/order-status-update';
import { ProcessOrderStatusUseCase } from '@components/trading/core/application/use-cases/process-order-status/process-order-status.use-case';
import { Config } from '@/config/config.schema';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';
import {
    HyperliquidWsEvent,
    HyperliquidWsOrderStatus,
} from '@/infra/hyperliquid/types/hyperliquid-ws-event';

@Injectable()
export class OrdersWebsocketAdapter implements OnModuleInit, OnModuleDestroy {
    private readonly logger = logger.child({ context: OrdersWebsocketAdapter.name });
    private readonly wsClient: WebSocketClient;
    private accountAddress: string | null = null;

    constructor(
        private readonly configService: ConfigService<Config, true>,
        private readonly processOrderStatus: ProcessOrderStatusUseCase,
        @Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort,
    ) {
        const hyperliquidConfig = this.configService.get('hyperliquid', { infer: true });

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

    async onModuleInit(): Promise<void> {
        // Look up the first active user to subscribe for
        const activeUsers = await this.usersApi.findActiveUsers();
        if (activeUsers.length > 1) {
            this.logger.warn(
                `WebSocket order subscription supports only 1 user; ${activeUsers.length} active users found. ` +
                    `Only ${activeUsers[0].accountAddress} will receive realtime updates.`,
            );
        }
        if (activeUsers.length > 0) {
            this.accountAddress = activeUsers[0].accountAddress;
        }

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
        if (!this.accountAddress) {
            this.logger.warn('No account address for WebSocket subscription');
            return;
        }

        this.wsClient.send({
            method: 'subscribe',
            subscription: { type: 'orderUpdates', user: this.accountAddress },
        });
        this.logger.info({ user: this.accountAddress }, 'Subscribed to orderUpdates');
    }

    private handleMessage(message: unknown): void {
        this.logger.debug({ message }, 'WebSocket message received');

        const msg = message as { method?: string; channel?: string };

        if (msg.method === 'pong') {
            this.logger.trace('Received pong');
            return;
        }

        if (msg.channel === 'orderUpdates') {
            this.handleOrderUpdates(message as HyperliquidWsEvent);
        }

        if (msg.channel === 'subscriptionResponse') {
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
