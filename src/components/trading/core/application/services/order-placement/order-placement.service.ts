import { Injectable, Inject } from '@nestjs/common';
import {
    EXCHANGE_CLIENT_PORT,
    ExchangeClientPort,
} from '@components/trading/core/application/ports/exchange-client.port';
import { GRIDS_PORT, GridsPort } from '@components/grids/core/application/ports/grids.port';
import { Grid } from '@domain/models/grid/grid';
import { Order } from '@domain/models/order/order';
import { OrderId } from '@domain/models/order/order-id';
import { OrderType } from '@domain/models/order/order-type';
import { OrderStatus } from '@domain/models/order/order-status';
import { ExchangePlaceOrderParams } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-params';
import { Decimal } from '@domain/models/primitives/decimal';
import { logger } from '@/infra/logger/logger';
import { extractErrorDetails } from '@/infra/logger/error-logger.helper';
import { GridLevel } from '@components/trading/core/domain/services/grid-levels-calculator/grid-level';

@Injectable()
export class OrderPlacementService {
    private readonly logger = logger.child({ context: OrderPlacementService.name });

    constructor(
        @Inject(EXCHANGE_CLIENT_PORT) private readonly orderClient: ExchangeClientPort,
        @Inject(GRIDS_PORT) private readonly grids: GridsPort,
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

        await this.grids.saveOrder(order);

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
            await this.grids.updateOrderExchangeId(
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

        await this.grids.updateOrderStatus(order.id.toString(), OrderStatus.Failed);

        this.logger.warn(
            { level: level.index, error: result.error },
            'Failed to place order - marked as failed',
        );

        return false;
    }
}
