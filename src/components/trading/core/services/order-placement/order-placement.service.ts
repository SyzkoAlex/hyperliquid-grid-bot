import { Injectable } from '@nestjs/common';
import { HyperliquidOrderClient } from '../../../secondary/client/hyperliquid/hyperliquid-order.client';
import { PostgresOrderRepository } from '../../../secondary/repository/order/postgres-order.repository';
import { Grid } from '@domain/grid/grid';
import { Order } from '@domain/order/order';
import { OrderId } from '@domain/order/order-id';
import { OrderType } from '@domain/order/order-type';
import { OrderStatus } from '@domain/order/order-status';
import { ExchangePlaceOrderParams } from '@components/trading/core/domain/exchange-order/exchange-place-order-params';
import { Decimal } from '../../../../../domain/primitives/decimal';
import { logger } from '../../../../../infra/logger/logger';
import { extractErrorDetails } from '../../../../../infra/logger/error-logger.helper';
import { GridLevel } from '../grid-levels-calculator/grid-level';

@Injectable()
export class OrderPlacementService {
    private readonly logger = logger.child({ context: OrderPlacementService.name });

    constructor(
        private readonly orderClient: HyperliquidOrderClient,
        private readonly orderRepository: PostgresOrderRepository,
    ) {}

    async placeGridOrders(grid: Grid, levels: GridLevel[]): Promise<number> {
        let placedCount = 0;

        for (const level of levels) {
            try {
                const placed = await this.placeOrderForLevel(grid, level);
                if (placed) {
                    placedCount++;
                }
            } catch (error) {
                this.logger.error(
                    { ...extractErrorDetails(error), level: level.index },
                    'Failed to place grid order',
                );
            }
        }

        return placedCount;
    }

    private async placeOrderForLevel(grid: Grid, level: GridLevel): Promise<boolean> {
        const order = await this.createAndSavePendingOrder(grid, level);
        const orderParams = this.buildOrderParams(order, grid, level);
        const result = await this.orderClient.placeSpotOrder(orderParams);

        return await this.updateOrderStatus(order, level, result);
    }

    private async createAndSavePendingOrder(grid: Grid, level: GridLevel): Promise<Order> {
        const orderId = OrderId.create();
        const order = Order.create({
            id: orderId,
            exchangeOrderId: undefined,
            symbol: grid.symbol,
            type: OrderType.Limit,
            side: level.side,
            price: level.price,
            amount: Decimal.from(level.amountBase!),
            status: OrderStatus.Pending,
            gridId: grid.id,
            levelIndex: level.index,
        });

        await this.orderRepository.save(order);

        this.logger.debug(
            { level: level.index, orderId: order.id.toString() },
            'Order saved with pending status',
        );

        return order;
    }

    private buildOrderParams(order: Order, grid: Grid, level: GridLevel): ExchangePlaceOrderParams {
        return {
            symbol: grid.symbol,
            side: level.side,
            price: level.price,
            amount: Decimal.from(level.amountBase!),
            orderId: order.id,
        };
    }

    private async updateOrderStatus(
        order: Order,
        level: GridLevel,
        result: { exchangeOrderId?: string; status: OrderStatus; error?: string },
    ): Promise<boolean> {
        if (result.exchangeOrderId && result.status !== OrderStatus.Failed) {
            await this.orderRepository.updateExchangeOrderId(
                order.id.toString(),
                result.exchangeOrderId,
                OrderStatus.Placed,
                new Date(),
            );

            this.logger.debug(
                { level: level.index, orderId: result.exchangeOrderId },
                'Order placed and updated with exchangeOrderId',
            );

            return true;
        }

        await this.orderRepository.updateStatus(order.id.toString(), OrderStatus.Failed);

        this.logger.warn(
            { level: level.index, error: result.error },
            'Failed to place order - marked as failed',
        );

        return false;
    }
}
