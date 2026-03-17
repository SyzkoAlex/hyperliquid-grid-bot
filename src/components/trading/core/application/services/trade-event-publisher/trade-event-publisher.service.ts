import { Inject, Injectable } from '@nestjs/common';
import { OrderSide } from '@domain/models/order/order-side';
import { Decimal } from '@domain/models/primitives/decimal';
import {
    EVENT_PUBLISHER_PORT,
    EventPublisherPort,
} from '@/core/application/ports/outbound/event-publisher.port';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';
import { OrderClosedEvent } from '@domain/models/events/trading/order-closed.event';
import { ProfitCalculatorService } from '@components/trading/core/domain/services/profit-calculator/profit-calculator.service';
import { GridDto } from '@components/grids/api/dto/grid.dto';
import { OrderDto } from '@components/grids/api/dto/order.dto';

@Injectable()
export class TradeEventPublisher {
    constructor(
        @Inject(EVENT_PUBLISHER_PORT) private readonly publisher: EventPublisherPort,
        private readonly profitCalculator: ProfitCalculatorService,
    ) {}

    async publishFillEvent(filledOrder: OrderDto, grid: GridDto): Promise<Decimal | null> {
        const profit = this.calculateProfit(filledOrder, grid);
        const filledPrice = filledOrder.price ?? 0;
        const filledAmount = filledOrder.amount;
        const total = filledPrice * filledAmount;
        const level = filledOrder.levelIndex + 1;

        if (profit !== null) {
            await this.publisher.publish(
                this.createOrderClosedEvent(
                    filledOrder,
                    grid,
                    filledPrice,
                    filledAmount,
                    total,
                    level,
                    profit,
                ),
            );
            return profit;
        }

        await this.publisher.publish(
            this.createOrderOpenedEvent(filledOrder, grid, filledPrice, filledAmount, total, level),
        );
        return null;
    }

    private createOrderClosedEvent(
        filledOrder: OrderDto,
        grid: GridDto,
        filledPrice: number,
        filledAmount: number,
        total: number,
        level: number,
        profit: Decimal,
    ): OrderClosedEvent {
        return new OrderClosedEvent(
            grid.id,
            grid.symbol,
            filledOrder.side,
            filledPrice,
            filledAmount,
            total,
            profit.toNumber(),
            level,
            grid.levels,
        );
    }

    private createOrderOpenedEvent(
        filledOrder: OrderDto,
        grid: GridDto,
        filledPrice: number,
        filledAmount: number,
        total: number,
        level: number,
    ): OrderOpenedEvent {
        return new OrderOpenedEvent(
            grid.id,
            grid.symbol,
            filledOrder.side,
            filledPrice,
            filledAmount,
            total,
            level,
            grid.levels,
        );
    }

    private calculateProfit(filledOrder: OrderDto, grid: GridDto): Decimal | null {
        if (filledOrder.side !== OrderSide.Sell) return null;
        return this.profitCalculator.calculate(
            filledOrder.amount,
            grid.upperPrice,
            grid.lowerPrice,
            grid.levels,
        );
    }
}
