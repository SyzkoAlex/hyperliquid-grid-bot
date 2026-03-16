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
                return this.handleDuplicateActiveOrder(
                    grid.id,
                    refillParams.levelIndex,
                    refillParams.side,
                );
            }

            const placeResult = await this.refillPlacement.placeRefillOrder(grid, refillParams);
            if (!placeResult.success) {
                return OrderRefillResult.failure(placeResult.error!);
            }

            const profit = await this.tradeEventPublisher.publishFillEvent(filledOrder, grid);

            this.logSuccess(grid, filledOrder, placeResult.order!, refillParams, profit);
            return OrderRefillResult.success(placeResult.order!, profit?.toNumber());
        } catch (error) {
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

    private handleDuplicateActiveOrder(
        gridId: string,
        levelIndex: number,
        side: OrderSide,
    ): OrderRefillResult {
        this.logger.warn(
            { gridId, levelIndex, side },
            'Refill skipped: active order already exists at target level',
        );
        return OrderRefillResult.failure('Active order already exists at target level');
    }

    private handleEdgeLevel(filledOrder: OrderDto): OrderRefillResult {
        this.logger.warn(
            { orderId: filledOrder.id, levelIndex: filledOrder.levelIndex },
            'Cannot calculate refill params (edge level)',
        );

        return OrderRefillResult.failure('Edge level - no refill needed');
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
