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
import { GridLevel } from '@components/trading/core/domain/services/grid-levels-calculator/grid-level';
import { AgentNotApprovedError } from '@components/trading/core/domain/errors/agent-not-approved.error';
import { HandleAgentExpiredUseCase } from '@components/trading/core/application/use-cases/handle-agent-expired/handle-agent-expired.use-case';

@Injectable()
export class OrderPlacementService {
    private readonly logger = logger.child({ context: OrderPlacementService.name });

    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        private readonly handleAgentExpiredUseCase: HandleAgentExpiredUseCase,
    ) {}

    async placeGridOrders(
        grid: GridDto,
        levels: GridLevel[],
        accountAddress: string,
    ): Promise<number> {
        let placedCount = 0;

        for (const level of levels) {
            try {
                const placed = await this.placeOrderForLevel(grid, level, accountAddress);
                if (placed) {
                    placedCount++;
                }
            } catch (error) {
                this.logger.error({ err: error, level: level.index }, 'Failed to place grid order');
            }
        }

        return placedCount;
    }

    private async placeOrderForLevel(
        grid: GridDto,
        level: GridLevel,
        accountAddress: string,
    ): Promise<boolean> {
        const order = await this.createAndSavePendingOrder(grid, level);
        try {
            const result = await this.exchange.placeSpotOrder({
                symbol: TradingSymbol.create(grid.symbol),
                side: level.side,
                price: level.price,
                amount: Decimal.from(level.amountBase!),
                orderId: order.id,
                accountAddress,
            });
            return await this.updateOrderStatus(order, level, result);
        } catch (error) {
            if (error instanceof AgentNotApprovedError) {
                await this.handleAgentExpiredUseCase.execute(error.accountAddress);
                return false;
            }
            throw error;
        }
    }

    private async createAndSavePendingOrder(grid: GridDto, level: GridLevel): Promise<OrderDto> {
        const orderId = uuidv4();
        const order = await this.grids.createOrder({
            id: orderId,
            gridId: grid.id,
            symbol: grid.symbol,
            side: level.side,
            type: OrderType.Limit,
            levelIndex: level.index,
            price: level.price.toNumber(),
            amount: level.amountBase!,
        });

        this.logger.debug(
            { level: level.index, orderId: order.id },
            'Order saved with pending status',
        );

        return order;
    }

    private async updateOrderStatus(
        order: OrderDto,
        level: GridLevel,
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
                { level: level.index, orderId: result.exchangeOrderId },
                'Order placed and updated with exchangeOrderId',
            );

            return true;
        }

        await this.grids.updateOrderStatus(order.id, OrderStatus.Failed);

        this.logger.warn(
            { level: level.index, error: result.error },
            'Failed to place order - marked as failed',
        );

        return false;
    }
}
