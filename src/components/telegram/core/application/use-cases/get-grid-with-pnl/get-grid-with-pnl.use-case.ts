import { Inject, Injectable } from '@nestjs/common';
import { GridId } from '@domain/models/grid/grid-id';
import { GridPnlCalculatorService } from '@domain/services/grid-pnl-calculator/grid-pnl-calculator.service';
import {
    EXCHANGE_INFO_PORT,
    ExchangeInfoPort,
} from '@components/telegram/core/application/ports/exchange-info.port';
import {
    TELEGRAM_GRID_REPOSITORY_PORT,
    TelegramGridRepositoryPort,
} from '@components/telegram/core/application/ports/grid-repository.port';
import {
    TELEGRAM_ORDER_REPOSITORY_PORT,
    TelegramOrderRepositoryPort,
} from '@components/telegram/core/application/ports/order-repository.port';
import { GridWithPnl } from '../get-grids-with-pnl/grid-with-pnl';
import { computeOrderStats } from '../get-grids-with-pnl/get-grids-with-pnl.use-case';

@Injectable()
export class GetGridWithPnlUseCase {
    constructor(
        @Inject(TELEGRAM_GRID_REPOSITORY_PORT)
        private readonly gridRepository: TelegramGridRepositoryPort,
        @Inject(TELEGRAM_ORDER_REPOSITORY_PORT)
        private readonly orderRepository: TelegramOrderRepositoryPort,
        @Inject(EXCHANGE_INFO_PORT)
        private readonly infoClient: ExchangeInfoPort,
        private readonly pnlCalculator: GridPnlCalculatorService,
    ) {}

    async execute(id: GridId): Promise<GridWithPnl | null> {
        const grid = await this.gridRepository.findOneById(id);
        if (!grid) return null;

        const [orders, currentPrice] = await Promise.all([
            this.orderRepository.findManyByGridId(grid.id),
            this.infoClient.getCurrentPrice(grid.symbol),
        ]);

        const price = currentPrice.toNumber();
        const pnl = this.pnlCalculator.calculate(orders, price);
        const orderStats = computeOrderStats(orders);

        return { grid, pnl, currentPrice: price, orderStats, orders };
    }
}
