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
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Decimal } from '@domain/models/primitives/decimal';
import { logger } from '@/infra/logger/logger';
import { GridOrder } from '@components/trading/core/domain/services/grid-orders-calculator/grid-order';
import { AgentNotApprovedError } from '@components/trading/core/domain/errors/agent-not-approved.error';
import {
    AGENT_EXPIRATION_HANDLER_PORT,
    AgentExpirationHandlerPort,
} from '@components/trading/core/application/ports/agent-expiration-handler.port';

@Injectable()
export class OrderPlacementService {
    private readonly logger = logger.child({ context: OrderPlacementService.name });

    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(AGENT_EXPIRATION_HANDLER_PORT)
        private readonly agentExpirationHandler: AgentExpirationHandlerPort,
    ) {}

    async placeGridOrders(
        grid: GridDto,
        gridOrders: GridOrder[],
        accountAddress: string,
    ): Promise<number> {
        let placedCount = 0;

        for (const gridOrder of gridOrders) {
            try {
                const placed = await this.placeGridOrder(grid, gridOrder, accountAddress);
                if (placed) {
                    placedCount++;
                }
            } catch (error) {
                this.logger.error(
                    { err: error, orderIndex: gridOrder.index },
                    'Failed to place grid order',
                );
            }
        }

        return placedCount;
    }

    private async placeGridOrder(
        grid: GridDto,
        gridOrder: GridOrder,
        accountAddress: string,
    ): Promise<boolean> {
        const order = await this.createAndSavePendingOrder(grid, gridOrder);
        try {
            const result = await this.exchange.placeSpotOrder({
                symbol: TradingSymbol.create(grid.symbol),
                side: gridOrder.side,
                price: gridOrder.price,
                amount: Decimal.from(gridOrder.amountBase!),
                orderId: order.id,
                accountAddress,
            });
            return await this.updateOrderStatus(order, gridOrder, result);
        } catch (error) {
            if (error instanceof AgentNotApprovedError) {
                await this.agentExpirationHandler.handleAgentExpired(error.accountAddress);
                await this.cleanupPendingOrder(order);
                return false;
            }
            throw error;
        }
    }

    private async cleanupPendingOrder(order: OrderDto): Promise<void> {
        try {
            await this.grids.updateOrderStatus(order.id, OrderStatus.Failed);
        } catch (cleanupError) {
            this.logger.error(
                { cleanupError, orderId: order.id },
                'Failed to mark stuck pending order as failed',
            );
        }
    }

    private async createAndSavePendingOrder(
        grid: GridDto,
        gridOrder: GridOrder,
    ): Promise<OrderDto> {
        const orderId = uuidv4();
        const order = await this.grids.createOrder({
            id: orderId,
            gridId: grid.id,
            symbol: grid.symbol,
            side: gridOrder.side,
            type: OrderType.Limit,
            orderIndex: gridOrder.index,
            price: gridOrder.price.toNumber(),
            amount: gridOrder.amountBase!,
        });

        this.logger.debug(
            { orderIndex: gridOrder.index, orderId: order.id },
            'Order saved with pending status',
        );

        return order;
    }

    private async updateOrderStatus(
        order: OrderDto,
        gridOrder: GridOrder,
        result: { exchangeOrderId?: string; status: OrderStatus; error?: string },
    ): Promise<boolean> {
        if (result.exchangeOrderId && result.status !== OrderStatus.Failed) {
            await this.grids.updateOrderExchangeId(
                order.id,
                result.exchangeOrderId,
                OrderStatus.Placed,
                new Date(),
            );

            this.logger.debug(
                { orderIndex: gridOrder.index, orderId: result.exchangeOrderId },
                'Order placed and updated with exchangeOrderId',
            );

            return true;
        }

        await this.grids.updateOrderStatus(order.id, OrderStatus.Failed);

        this.logger.warn(
            { orderIndex: gridOrder.index, error: result.error },
            'Failed to place order - marked as failed',
        );

        return false;
    }
}
