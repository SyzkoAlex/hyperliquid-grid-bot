import { Inject, Injectable } from '@nestjs/common';
import { GridPnlCalculatorService } from '../../../domain/services/grid-pnl-calculator/grid-pnl-calculator.service';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { computeOrderStats } from '../../../domain/models/grid-pnl';
import { GridWithPnl } from '../get-grids-with-pnl/grid-with-pnl';

@Injectable()
export class GetGridWithPnlUseCase {
    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
        private readonly pnlCalculator: GridPnlCalculatorService,
    ) {}

    async execute(id: string): Promise<GridWithPnl | null> {
        const grid = await this.grids.findGridById(id);
        if (!grid) return null;

        const [orders, currentPrice] = await Promise.all([
            this.grids.findOrdersByGridId(grid.id),
            this.tradingApi.getCurrentPrice(grid.symbol),
        ]);

        const pnl = this.pnlCalculator.calculate(orders, currentPrice);
        const orderStats = computeOrderStats(orders);

        return { grid, pnl, currentPrice, orderStats, orders };
    }
}
