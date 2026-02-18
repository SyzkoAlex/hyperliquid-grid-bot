import { Inject, Injectable } from '@nestjs/common';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GridPnlCalculatorService } from '@domain/services/grid-pnl-calculator/grid-pnl-calculator.service';
import { INFO_CLIENT_PORT, InfoClientPort } from '@domain/ports/outbound/info-client.port';
import { OrderStatus } from '@domain/models/order/order-status';
import { OrderSide } from '@domain/models/order/order-side';
import {
    TELEGRAM_GRID_REPOSITORY_PORT,
    TelegramGridRepositoryPort,
} from '@components/telegram/domain/ports/outbound/grid-repository.port';
import {
    TELEGRAM_ORDER_REPOSITORY_PORT,
    TelegramOrderRepositoryPort,
} from '@components/telegram/domain/ports/outbound/order-repository.port';
import { GridFilter } from './grid-filter';
import { GridWithPnl } from './grid-with-pnl';

@Injectable()
export class GetGridsWithPnlUseCase {
    constructor(
        @Inject(TELEGRAM_GRID_REPOSITORY_PORT)
        private readonly gridRepository: TelegramGridRepositoryPort,
        @Inject(TELEGRAM_ORDER_REPOSITORY_PORT)
        private readonly orderRepository: TelegramOrderRepositoryPort,
        @Inject(INFO_CLIENT_PORT)
        private readonly infoClient: InfoClientPort,
        private readonly pnlCalculator: GridPnlCalculatorService,
    ) {}

    async execute(filter: GridFilter = GridFilter.All): Promise<GridWithPnl[]> {
        const grids = await this.fetchGrids(filter);

        return Promise.all(
            grids.map(async (grid) => {
                const [orders, currentPrice] = await Promise.all([
                    this.orderRepository.findManyByGridId(grid.id),
                    this.infoClient.getCurrentPrice(grid.symbol),
                ]);
                const pnl = this.pnlCalculator.calculate(orders);
                const profitableTrades = orders.filter(
                    (o) => o.status === OrderStatus.Filled && o.side === OrderSide.Sell,
                ).length;
                return { grid, pnl, currentPrice: currentPrice.toNumber(), profitableTrades };
            }),
        );
    }

    private async fetchGrids(filter: GridFilter) {
        if (filter === GridFilter.Running) {
            return this.gridRepository.findManyByStatus(GridStatus.Running);
        }
        if (filter === GridFilter.Stopped) {
            return this.gridRepository.findManyByStatus(GridStatus.Stopped);
        }
        return this.gridRepository.findAll();
    }
}
