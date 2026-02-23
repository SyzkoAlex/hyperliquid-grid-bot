import { Inject, Injectable } from '@nestjs/common';
import { GridId } from '@domain/models/grid/grid-id';
import { GridPnlCalculatorService } from '@domain/services/grid-pnl-calculator/grid-pnl-calculator.service';
import {
    TRADING_QUERY_PORT,
    TradingQueryPort,
} from '@components/trading/core/application/ports/trading-query.port';
import { GRIDS_PORT, GridsPort } from '@components/grids/core/application/ports/grids.port';
import { GridWithPnl } from '../get-grids-with-pnl/grid-with-pnl';
import { computeOrderStats } from '../get-grids-with-pnl/get-grids-with-pnl.use-case';

@Injectable()
export class GetGridWithPnlUseCase {
    constructor(
        @Inject(GRIDS_PORT) private readonly grids: GridsPort,
        @Inject(TRADING_QUERY_PORT) private readonly tradingQuery: TradingQueryPort,
        private readonly pnlCalculator: GridPnlCalculatorService,
    ) {}

    async execute(id: GridId): Promise<GridWithPnl | null> {
        const grid = await this.grids.findGridById(id);
        if (!grid) return null;

        const [orders, currentPrice] = await Promise.all([
            this.grids.findOrdersByGridId(grid.id),
            this.tradingQuery.getCurrentPrice(grid.symbol),
        ]);

        const price = currentPrice.toNumber();
        const pnl = this.pnlCalculator.calculate(orders, price);
        const orderStats = computeOrderStats(orders);

        return { grid, pnl, currentPrice: price, orderStats, orders };
    }
}
