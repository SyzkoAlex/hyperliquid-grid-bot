import { Inject, Injectable } from '@nestjs/common';
import { GridStatus } from '@domain/models/grid/grid-status';
import { GridPnlCalculatorService } from '../../../domain/services/grid-pnl-calculator/grid-pnl-calculator.service';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { computeOrderStats } from '../../../domain/models/grid-pnl';
import { GridFilter } from './grid-filter';
import { GridWithPnl } from './grid-with-pnl';

@Injectable()
export class GetGridsWithPnlUseCase {
    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
        private readonly pnlCalculator: GridPnlCalculatorService,
    ) {}

    async execute(filter: GridFilter = GridFilter.All): Promise<GridWithPnl[]> {
        const gridList = await this.fetchGrids(filter);

        return Promise.all(
            gridList.map(async (grid) => {
                const [orders, currentPrice] = await Promise.all([
                    this.grids.findOrdersByGridId(grid.id),
                    this.tradingApi.getCurrentPrice(grid.symbol),
                ]);
                const pnl = this.pnlCalculator.calculate(orders, currentPrice);
                const orderStats = computeOrderStats(orders);
                return { grid, pnl, currentPrice, orderStats, orders };
            }),
        );
    }

    private async fetchGrids(filter: GridFilter) {
        if (filter === GridFilter.Running) {
            return this.grids.findGridsByStatus(GridStatus.Running);
        }
        if (filter === GridFilter.Stopped) {
            return this.grids.findGridsByStatus(GridStatus.Stopped);
        }
        return this.grids.findAllGrids();
    }
}
