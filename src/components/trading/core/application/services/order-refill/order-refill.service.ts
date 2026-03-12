import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { OrderType } from '@domain/models/order/order-type';
import { OrderSide } from '@domain/models/order/order-side';
import { OrderStatus } from '@domain/models/order/order-status';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { ExchangePlaceOrderResult } from '@components/trading/core/domain/models/exchange-order/exchange-place-order-result';
import {
    EVENT_PUBLISHER_PORT,
    EventPublisherPort,
} from '@/core/application/ports/outbound/event-publisher.port';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';
import { OrderClosedEvent } from '@domain/models/events/trading/order-closed.event';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Decimal } from '@domain/models/primitives/decimal';
import { logger } from '@/infra/logger/logger';
import { OrderRefillResult } from './order-refill-result';
import { RefillParams } from './refill-params';
import { ProfitCalculatorService } from '@components/trading/core/domain/services/profit-calculator/profit-calculator.service';

@Injectable()
export class OrderRefillService {
    private readonly logger = logger.child({ context: OrderRefillService.name });

    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(EVENT_PUBLISHER_PORT) private readonly publisher: EventPublisherPort,
        private readonly profitCalculator: ProfitCalculatorService,
    ) {}

    async processMany(filledOrders: OrderDto[], grid: GridDto): Promise<number> {
        const deduped = this.deduplicateOrders(filledOrders, grid);

        let placed = 0;
        for (const order of deduped) {
            const result = await this.processOne(order, grid);
            if (result.success) placed++;
        }
        return placed;
    }

    async processOne(filledOrder: OrderDto, grid: GridDto): Promise<OrderRefillResult> {
        this.logOrderProcessing(filledOrder, grid);

        let refillOrder: OrderDto | null = null;

        try {
            const refillParams = RefillParams.calc(filledOrder, grid);
            if (!refillParams) {
                return this.handleEdgeLevel(filledOrder);
            }

            if (
                await this.hasActiveOrderAtLevel(
                    grid.id,
                    refillParams.levelIndex,
                    refillParams.side,
                )
            ) {
                this.logger.warn(
                    {
                        gridId: grid.id,
                        levelIndex: refillParams.levelIndex,
                        side: refillParams.side,
                    },
                    'Refill skipped: active order already exists at target level',
                );
                return OrderRefillResult.failure('Active order already exists at target level');
            }

            refillOrder = await this.createAndSavePendingOrder(grid, refillParams);
            const placeResult = await this.placeOrderOnExchange(refillOrder, grid, refillParams);

            if (!this.isPlacementSuccessful(placeResult)) {
                return await this.handlePlacementFailure(refillOrder, placeResult);
            }

            await this.updateOrderAsPlaced(refillOrder, placeResult);

            const profit =
                filledOrder.side === OrderSide.Sell
                    ? this.profitCalculator.calculate(
                          filledOrder.amount,
                          grid.upperPrice,
                          grid.lowerPrice,
                          grid.levels,
                      )
                    : null;
            await this.publishTradeEvent(filledOrder, grid, profit);

            this.logSuccess(grid, filledOrder, refillOrder, refillParams, profit);

            return OrderRefillResult.success(refillOrder, profit?.toNumber());
        } catch (error) {
            if (refillOrder) {
                await this.grids.updateOrderStatus(refillOrder.id, OrderStatus.Failed);
            }
            return this.handleError(error, filledOrder);
        }
    }

    private logOrderProcessing(filledOrder: OrderDto, grid: GridDto): void {
        this.logger.info(
            {
                gridId: grid.id,
                orderId: filledOrder.id,
                side: filledOrder.side,
                level: filledOrder.levelIndex,
                price: filledOrder.price,
            },
            'Processing filled order',
        );
    }

    private handleEdgeLevel(filledOrder: OrderDto): OrderRefillResult {
        this.logger.warn(
            { orderId: filledOrder.id, levelIndex: filledOrder.levelIndex },
            'Cannot calculate refill params (edge level)',
        );

        return OrderRefillResult.failure('Edge level - no refill needed');
    }

    private async createAndSavePendingOrder(
        grid: GridDto,
        refillParams: RefillParams,
    ): Promise<OrderDto> {
        const orderId = uuidv4();
        const refillOrder = await this.grids.createOrder({
            id: orderId,
            gridId: grid.id,
            symbol: grid.symbol,
            side: refillParams.side,
            type: OrderType.Limit,
            levelIndex: refillParams.levelIndex,
            price: refillParams.price.toNumber(),
            amount: refillParams.amount.toNumber(),
        });

        this.logger.debug(
            { orderId: refillOrder.id, levelIndex: refillParams.levelIndex },
            'Refill order saved with pending status',
        );

        return refillOrder;
    }

    private async placeOrderOnExchange(
        refillOrder: OrderDto,
        grid: GridDto,
        refillParams: RefillParams,
    ) {
        return await this.exchange.placeSpotOrder({
            symbol: TradingSymbol.create(grid.symbol),
            side: refillParams.side,
            price: refillParams.price,
            amount: refillParams.amount,
            orderId: refillOrder.id,
        });
    }

    private isPlacementSuccessful(placeResult: ExchangePlaceOrderResult): boolean {
        return Boolean(placeResult.exchangeOrderId && placeResult.status !== OrderStatus.Failed);
    }

    private async handlePlacementFailure(
        refillOrder: OrderDto,
        placeResult: ExchangePlaceOrderResult,
    ): Promise<OrderRefillResult> {
        await this.grids.updateOrderStatus(refillOrder.id, OrderStatus.Failed);

        this.logger.error(
            { error: placeResult.error, orderId: refillOrder.id },
            'Failed to place refill order - marked as failed',
        );

        return OrderRefillResult.failure(placeResult.error || 'Failed to place refill order');
    }

    private async updateOrderAsPlaced(
        refillOrder: OrderDto,
        placeResult: ExchangePlaceOrderResult,
    ): Promise<void> {
        await this.grids.updateOrderExchangeId(
            refillOrder.id,
            placeResult.exchangeOrderId,
            OrderStatus.Placed,
            new Date(),
        );

        this.logger.debug(
            { orderId: refillOrder.id, exchangeOrderId: placeResult.exchangeOrderId },
            'Refill order placed and updated with exchangeOrderId',
        );
    }

    private async publishTradeEvent(
        filledOrder: OrderDto,
        grid: GridDto,
        profit: Decimal | null,
    ): Promise<void> {
        const filledPrice = filledOrder.price ?? 0;
        const filledAmount = filledOrder.amount;
        const total = filledPrice * filledAmount;

        if (profit !== null) {
            const closedEvent = new OrderClosedEvent(
                grid.id,
                grid.symbol,
                filledOrder.side,
                filledPrice,
                filledAmount,
                total,
                profit.toNumber(),
                filledOrder.levelIndex,
                grid.levels,
            );
            await this.publisher.publish(closedEvent);
            return;
        }

        const openedEvent = new OrderOpenedEvent(
            grid.id,
            grid.symbol,
            filledOrder.side,
            filledPrice,
            filledAmount,
            total,
            filledOrder.levelIndex,
            grid.levels,
        );
        await this.publisher.publish(openedEvent);
    }

    private logSuccess(
        grid: GridDto,
        filledOrder: OrderDto,
        refillOrder: OrderDto,
        refillParams: RefillParams,
        profit: Decimal | null,
    ): void {
        this.logger.info(
            {
                gridId: grid.id,
                filledOrderId: filledOrder.id,
                refillOrderId: refillOrder.id,
                refillSide: refillParams.side,
                refillLevel: refillParams.levelIndex,
                profit: profit?.toNumber() ?? null,
            },
            'Refill order placed successfully',
        );
    }

    private handleError(error: unknown, filledOrder: OrderDto): OrderRefillResult {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        this.logger.error(
            { errorMessage, errorStack, orderId: filledOrder.id },
            'Error processing filled order',
        );

        return OrderRefillResult.failure(errorMessage);
    }

    private async hasActiveOrderAtLevel(
        gridId: string,
        levelIndex: number,
        side: OrderSide,
    ): Promise<boolean> {
        const activeOrders = await this.grids.findActiveOrdersByGridId(gridId);
        return activeOrders.some((o) => o.levelIndex === levelIndex && o.side === side);
    }

    private deduplicateOrders(filledOrders: OrderDto[], grid: GridDto): OrderDto[] {
        const seen = new Set<string>();
        const result: OrderDto[] = [];

        for (const order of filledOrders) {
            const params = RefillParams.calc(order, grid);
            if (!params) continue;

            const key = `${params.levelIndex}-${params.side}`;
            if (seen.has(key)) {
                this.logger.debug(
                    { levelIndex: params.levelIndex, side: params.side },
                    'Refill skipped: duplicate',
                );
                continue;
            }

            seen.add(key);
            result.push(order);
        }

        return result;
    }
}
