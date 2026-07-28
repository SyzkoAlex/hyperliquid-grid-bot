import { Inject, Injectable } from '@nestjs/common';
import { OrderSide } from '@domain/models/order/order-side';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';
import { Decimal } from '@domain/models/primitives/decimal';
import { logger } from '@/infra/logger/logger';
import { OrderRefillResult } from './order-refill-result';
import { RefillParams } from './refill-params';
import { RefillOrderPlacementService } from '../refill-order-placement/refill-order-placement.service';
import { TradeEventPublisher } from '../trade-event-publisher/trade-event-publisher.service';

@Injectable()
export class OrderRefillService {
    private readonly logger = logger.child({ context: OrderRefillService.name });

    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        private readonly refillPlacement: RefillOrderPlacementService,
        private readonly tradeEventPublisher: TradeEventPublisher,
    ) {}

    async processMany(
        filledOrders: OrderDto[],
        grid: GridDto,
        accountAddress: string,
    ): Promise<number> {
        const deduped = this.deduplicateOrders(filledOrders, grid);

        let placed = 0;
        for (const order of deduped) {
            const result = await this.processOne(order, grid, accountAddress);
            if (result.success) placed++;
        }
        return placed;
    }

    async processOne(
        filledOrder: OrderDto,
        grid: GridDto,
        accountAddress: string,
    ): Promise<OrderRefillResult> {
        this.logOrderProcessing(filledOrder, grid);

        const profit = await this.publishFillEventSafe(filledOrder, grid);

        try {
            let currentOrder = filledOrder;
            let lastPlacedOrder: OrderDto | undefined;

            for (let depth = 0; depth < grid.orderCount; depth++) {
                const refillParams = RefillParams.calc(currentOrder, grid);
                if (!refillParams) {
                    if (!lastPlacedOrder) return this.handleEdgeOrder(filledOrder);
                    break;
                }

                if (
                    await this.hasActiveOrderAtIndex(
                        grid.id,
                        refillParams.orderIndex,
                        refillParams.side,
                    )
                ) {
                    if (!lastPlacedOrder)
                        return this.handleDuplicateActiveOrder(
                            grid.id,
                            refillParams.orderIndex,
                            refillParams.side,
                        );
                    break;
                }

                const placeResult = await this.refillPlacement.placeRefillOrder(
                    grid,
                    refillParams,
                    accountAddress,
                );
                if (!placeResult.success) {
                    if (!lastPlacedOrder) return OrderRefillResult.failure(placeResult.error!);
                    break;
                }

                lastPlacedOrder = placeResult.order!;

                if (!placeResult.immediatelyFilled) break;

                this.logger.info(
                    {
                        gridId: grid.id,
                        orderIndex: refillParams.orderIndex,
                        side: refillParams.side,
                    },
                    'Refill order was immediately filled, continuing chain',
                );
                currentOrder = lastPlacedOrder;
            }

            if (!lastPlacedOrder) {
                return OrderRefillResult.failure('No refill placed');
            }

            this.logSuccess(grid, filledOrder, lastPlacedOrder, profit);
            return OrderRefillResult.success(lastPlacedOrder, profit?.toNumber());
        } catch (error) {
            return this.handleError(error, filledOrder);
        }
    }

    private async publishFillEventSafe(
        filledOrder: OrderDto,
        grid: GridDto,
    ): Promise<Decimal | null> {
        try {
            return await this.tradeEventPublisher.publishFillEvent(filledOrder, grid);
        } catch (err) {
            this.logger.error(
                { err, orderId: filledOrder.id, gridId: grid.id },
                'Failed to publish fill event',
            );
            return null;
        }
    }

    private logOrderProcessing(filledOrder: OrderDto, grid: GridDto): void {
        this.logger.info(
            {
                gridId: grid.id,
                orderId: filledOrder.id,
                side: filledOrder.side,
                orderIndex: filledOrder.orderIndex,
                price: filledOrder.price,
            },
            'Processing filled order',
        );
    }

    private handleDuplicateActiveOrder(
        gridId: string,
        orderIndex: number,
        side: OrderSide,
    ): OrderRefillResult {
        this.logger.warn(
            { gridId, orderIndex, side },
            'Refill skipped: active order already exists at target order index',
        );
        return OrderRefillResult.failure('Active order already exists at target order index');
    }

    private handleEdgeOrder(filledOrder: OrderDto): OrderRefillResult {
        this.logger.warn(
            { orderId: filledOrder.id, orderIndex: filledOrder.orderIndex },
            'Cannot calculate refill params (edge order)',
        );

        return OrderRefillResult.failure('Edge order - no refill needed');
    }

    private logSuccess(
        grid: GridDto,
        filledOrder: OrderDto,
        refillOrder: OrderDto,
        profit: Decimal | null,
    ): void {
        this.logger.info(
            {
                gridId: grid.id,
                filledOrderId: filledOrder.id,
                refillOrderId: refillOrder.id,
                refillSide: refillOrder.side,
                refillOrderIndex: refillOrder.orderIndex,
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

    private async hasActiveOrderAtIndex(
        gridId: string,
        orderIndex: number,
        side: OrderSide,
    ): Promise<boolean> {
        const activeOrders = await this.grids.findActiveOrdersByGridId(gridId);
        return activeOrders.some((o) => o.orderIndex === orderIndex && o.side === side);
    }

    private deduplicateOrders(filledOrders: OrderDto[], grid: GridDto): OrderDto[] {
        const seen = new Set<string>();
        const result: OrderDto[] = [];

        for (const order of filledOrders) {
            const params = RefillParams.calc(order, grid);
            if (!params) continue;

            const key = `${params.orderIndex}-${params.side}`;
            if (seen.has(key)) {
                this.logger.debug(
                    { orderIndex: params.orderIndex, side: params.side },
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
