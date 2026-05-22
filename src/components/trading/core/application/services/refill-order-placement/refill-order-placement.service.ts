import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { OrderType } from '@domain/models/order/order-type';
import { OrderStatus } from '@domain/models/order/order-status';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { ExchangePlaceOrderResult } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-result';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { DuplicateActiveOrderError } from '@components/grids/api/errors/duplicate-active-order.error';
import { logger } from '@/infra/logger/logger';
import { RefillParams } from '../order-refill/refill-params';
import { PlaceRefillOrderResult } from './place-refill-order-result';
import { AgentNotApprovedError } from '@components/trading/core/domain/errors/agent-not-approved.error';
import {
    AGENT_EXPIRATION_HANDLER_PORT,
    AgentExpirationHandlerPort,
} from '@components/trading/core/application/ports/agent-expiration-handler.port';

@Injectable()
export class RefillOrderPlacementService {
    private readonly logger = logger.child({ context: RefillOrderPlacementService.name });

    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(AGENT_EXPIRATION_HANDLER_PORT)
        private readonly agentExpirationHandler: AgentExpirationHandlerPort,
    ) {}

    async placeRefillOrder(
        grid: GridDto,
        params: RefillParams,
        accountAddress: string,
    ): Promise<PlaceRefillOrderResult> {
        let order: OrderDto | null = null;

        try {
            order = await this.createAndSavePendingOrder(grid, params);
            const placeResult = await this.placeOrderOnExchange(
                order,
                grid,
                params,
                accountAddress,
            );

            if (!this.isPlacementSuccessful(placeResult)) {
                return await this.handlePlacementFailure(order, placeResult);
            }

            await this.updateOrderAsPlaced(order, placeResult);
            return PlaceRefillOrderResult.success(order);
        } catch (error) {
            if (error instanceof AgentNotApprovedError) {
                await this.agentExpirationHandler.handleAgentExpired(error.accountAddress);
                await this.cleanupPendingOrder(order);
                return PlaceRefillOrderResult.failure('Agent approval expired');
            }
            if (error instanceof DuplicateActiveOrderError) {
                this.logger.warn(
                    { gridId: grid.id },
                    'Refill skipped: duplicate active order detected by DB constraint',
                );
                return PlaceRefillOrderResult.failure('Duplicate active order at level');
            }
            await this.cleanupPendingOrder(order);
            throw error;
        }
    }

    private async createAndSavePendingOrder(
        grid: GridDto,
        params: RefillParams,
    ): Promise<OrderDto> {
        const orderId = uuidv4();
        const order = await this.grids.createOrder({
            id: orderId,
            gridId: grid.id,
            symbol: grid.symbol,
            side: params.side,
            type: OrderType.Limit,
            levelIndex: params.levelIndex,
            price: params.price.toNumber(),
            amount: params.amount.toNumber(),
        });

        this.logger.debug(
            { orderId: order.id, levelIndex: params.levelIndex },
            'Refill order saved with pending status',
        );

        return order;
    }

    private async placeOrderOnExchange(
        order: OrderDto,
        grid: GridDto,
        params: RefillParams,
        accountAddress: string,
    ): Promise<ExchangePlaceOrderResult> {
        return this.exchange.placeSpotOrder({
            symbol: TradingSymbol.create(grid.symbol),
            side: params.side,
            price: params.price,
            amount: params.amount,
            orderId: order.id,
            accountAddress,
        });
    }

    private isPlacementSuccessful(placeResult: ExchangePlaceOrderResult): boolean {
        return Boolean(placeResult.exchangeOrderId && placeResult.status !== OrderStatus.Failed);
    }

    private async handlePlacementFailure(
        order: OrderDto,
        placeResult: ExchangePlaceOrderResult,
    ): Promise<PlaceRefillOrderResult> {
        await this.grids.updateOrderStatus(order.id, OrderStatus.Failed);

        this.logger.error(
            { error: placeResult.error, orderId: order.id },
            'Failed to place refill order - marked as failed',
        );

        return PlaceRefillOrderResult.failure(placeResult.error || 'Failed to place refill order');
    }

    private async updateOrderAsPlaced(
        order: OrderDto,
        placeResult: ExchangePlaceOrderResult,
    ): Promise<void> {
        await this.grids.updateOrderExchangeId(
            order.id,
            placeResult.exchangeOrderId,
            OrderStatus.Placed,
            new Date(),
        );

        this.logger.debug(
            { orderId: order.id, exchangeOrderId: placeResult.exchangeOrderId },
            'Refill order placed and updated with exchangeOrderId',
        );
    }

    private async cleanupPendingOrder(order: OrderDto | null): Promise<void> {
        if (!order) return;
        try {
            await this.grids.updateOrderStatus(order.id, OrderStatus.Failed);
        } catch (cleanupError) {
            this.logger.error(
                { cleanupError, orderId: order.id },
                'Failed to mark stuck pending order as failed',
            );
        }
    }
}
