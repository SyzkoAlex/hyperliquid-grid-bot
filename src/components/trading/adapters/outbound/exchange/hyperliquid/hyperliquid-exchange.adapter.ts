import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { METRICS_PORT, MetricsPort } from '@/core/application/ports/outbound/metrics.port';
import { startTimer } from '@/infra/metrics/timer';
import { HyperliquidOrdersService } from '@/infra/hyperliquid/orders/hyperliquid-orders.service';
import { HyperliquidInfoService } from '@/infra/hyperliquid/info/hyperliquid-info.service';
import { HyperliquidMetaService } from '@/infra/hyperliquid/meta/hyperliquid-meta.service';
import { ExchangePort } from '@components/trading/core/application/ports/exchange.port';
import { ExchangePlaceOrderParams } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-params';
import { ExchangePlaceOrderResult } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-result';
import { ExchangeCancelOrderParams } from '@components/trading/core/domain/models/exchange-order/exchange-cancel-order-params';
import { ExchangeCancelOrderResult } from '@components/trading/core/domain/models/exchange-order/exchange-cancel-order-result';
import { ExchangeOpenOrder } from '@components/trading/core/domain/models/exchange-order/exchange-open-order';
import { ExchangeOrderInfo } from '@components/trading/core/domain/models/exchange-order/exchange-order-info';
import { ExchangeOrderFill } from '@components/trading/core/domain/models/exchange-order/exchange-order-fill';
import { UserState } from '@components/trading/core/domain/models/user-state/user-state';
import { Price } from '@domain/models/primitives/price';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { ExchangeCloid } from '@components/trading/core/domain/models/exchange-order/exchange-cloid';
import { OrderSide } from '@domain/models/order/order-side';
import { HyperliquidExchangeMapper } from './hyperliquid-exchange.mapper';
import { PlaceSpotOrderInput } from '@/infra/hyperliquid/types/hyperliquid-place-spot-order-input';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';

@Injectable()
export class HyperliquidExchangeAdapter implements ExchangePort {
    private readonly logger = logger.child({ context: HyperliquidExchangeAdapter.name });

    constructor(
        private readonly orders: HyperliquidOrdersService,
        private readonly info: HyperliquidInfoService,
        private readonly meta: HyperliquidMetaService,
        private readonly mapper: HyperliquidExchangeMapper,
        @Inject(METRICS_PORT) private readonly metrics: MetricsPort,
        @Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort,
    ) {}

    async placeSpotOrder(params: ExchangePlaceOrderParams): Promise<ExchangePlaceOrderResult> {
        const stop = startTimer();
        try {
            const agentPrivateKey = await this.resolveAgentKey(params.accountAddress);
            const orderData: PlaceSpotOrderInput = {
                symbol: params.symbol.toString(),
                isBuy: params.side === OrderSide.Buy,
                amount: params.amount.toNumber(),
                price: params.price.toNumber(),
                cloid: ExchangeCloid.create(params.orderId).toString(),
                agentPrivateKey,
            };

            const response = await this.orders.placeSpotOrder(orderData);
            this.logger.info({ params, response }, 'Order placed');
            return this.mapper.toExchangePlaceOrderResult(response);
        } catch (error) {
            this.logger.error({ err: error, params }, 'Failed to place order');
            throw error;
        } finally {
            this.metrics.observeExchangeApiDuration('placeSpotOrder', stop());
        }
    }

    async cancelSpotOrder(params: ExchangeCancelOrderParams): Promise<ExchangeCancelOrderResult> {
        const stop = startTimer();
        try {
            const agentPrivateKey = await this.resolveAgentKey(params.accountAddress);
            const response = await this.orders.cancelSpotOrder({
                symbol: params.symbol.toString(),
                exchangeOrderId: Number(params.exchangeOrderId),
                agentPrivateKey,
            });
            this.logger.info({ params, response }, 'Order cancelled');
            return {
                exchangeOrderId: params.exchangeOrderId,
                success: response?.status === 'ok',
            };
        } catch (error) {
            this.logger.error({ err: error, params }, 'Failed to cancel order');
            return {
                exchangeOrderId: params.exchangeOrderId,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        } finally {
            this.metrics.observeExchangeApiDuration('cancelSpotOrder', stop());
        }
    }

    async getCurrentPrice(symbol: TradingSymbol): Promise<Price> {
        const stop = startTimer();
        try {
            const spotKey = this.meta.lookupSpotKey(symbol.toString());
            const mids = await this.info.getAllMids();
            const priceStr = mids[spotKey];
            if (!priceStr) {
                throw new Error(`Price not available for ${symbol.toString()}`);
            }
            return Price.from(parseFloat(priceStr));
        } finally {
            this.metrics.observeExchangeApiDuration('getCurrentPrice', stop());
        }
    }

    async getOpenSpotOrders(user: string): Promise<ExchangeOpenOrder[]> {
        const stop = startTimer();
        try {
            const orders = await this.info.getOpenOrders(user);
            const resolveSymbol = (coin: string) => this.meta.resolveSpotSymbol(coin);
            return this.mapper.toOpenOrders(orders, resolveSymbol);
        } catch (error) {
            this.logger.error({ err: error, user }, 'Failed to get open orders');
            throw error;
        } finally {
            this.metrics.observeExchangeApiDuration('getOpenSpotOrders', stop());
        }
    }

    async getOrderStatus(user: string, oid: number | string): Promise<ExchangeOrderInfo | null> {
        const stop = startTimer();
        try {
            const resolvedOid =
                typeof oid === 'string' && !oid.startsWith('0x') ? Number(oid) : oid;
            const response = await this.info.getOrderStatus(user, resolvedOid as number);

            if (!response) {
                return null;
            }

            return this.mapper.toExchangeOrderInfo(
                response as Parameters<typeof this.mapper.toExchangeOrderInfo>[0],
            );
        } catch (error) {
            this.logger.error({ err: error, user, oid }, 'Failed to get order status');
            throw error;
        } finally {
            this.metrics.observeExchangeApiDuration('getOrderStatus', stop());
        }
    }

    async getOrderFills(
        user: string,
        oid: number,
        startTime: number,
        endTime: number,
    ): Promise<ExchangeOrderFill[]> {
        const stop = startTimer();
        try {
            const fills = await this.info.getUserFills(user, startTime, endTime);
            return this.mapper.toExchangeOrderFills(fills, oid);
        } catch (error) {
            this.logger.error({ err: error, user, oid }, 'Failed to get order fills');
            return [];
        } finally {
            this.metrics.observeExchangeApiDuration('getOrderFills', stop());
        }
    }

    async getUserSpotState(user: string): Promise<UserState> {
        const stop = startTimer();
        try {
            const response = await this.info.getSpotClearinghouseState(user);
            return this.mapper.toUserState(response);
        } catch (error) {
            this.logger.error({ error, user }, 'Failed to get user state');
            throw error;
        } finally {
            this.metrics.observeExchangeApiDuration('getUserSpotState', stop());
        }
    }

    async pairExists(symbol: TradingSymbol): Promise<boolean> {
        const stop = startTimer();
        try {
            return await this.meta.pairExists(symbol.toString());
        } finally {
            this.metrics.observeExchangeApiDuration('pairExists', stop());
        }
    }

    async probeAgentApproval(accountAddress: string): Promise<{ approved: boolean }> {
        try {
            const agentPrivateKey = await this.resolveAgentKey(accountAddress);
            // Attempt to cancel a non-existent order — triggers signing with the agent key.
            // An unapproved agent will get a distinct "not approved" error.
            await this.orders.cancelSpotOrder({
                symbol: 'USDC',
                exchangeOrderId: 0,
                agentPrivateKey,
            });
            // Should never succeed for a non-existent order
            return { approved: true };
        } catch (err) {
            const message = String(err).toLowerCase();
            if (message.includes('not approved') || message.includes('agent not approved')) {
                return { approved: false };
            }
            // Any other error (e.g. "order not found") means the agent IS approved
            return { approved: true };
        }
    }

    private async resolveAgentKey(accountAddress: string): Promise<string> {
        const user = await this.usersApi.findUserByAccountAddress(accountAddress);
        if (!user) {
            throw new Error(`No user found for account address: ${accountAddress}`);
        }
        return this.usersApi.getAgentPrivateKey(user.id);
    }
}
