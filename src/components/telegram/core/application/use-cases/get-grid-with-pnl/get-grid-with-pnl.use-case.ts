import { Inject, Injectable } from '@nestjs/common';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { GridSnapshotFactory } from '../../services/grid-snapshot-factory/grid-snapshot.factory';

@Injectable()
export class GetGridWithPnlUseCase {
    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
        private readonly snapshotFactory: GridSnapshotFactory,
    ) {}

    async execute(id: string): Promise<GridSnapshot | null> {
        const grid = await this.grids.findGridById(id);
        if (!grid) return null;

        const [orders, currentPrice] = await Promise.all([
            this.grids.findOrdersByGridId(grid.id),
            this.tradingApi.getCurrentPrice(grid.symbol),
        ]);

        return this.snapshotFactory.create(grid, orders, currentPrice);
    }
}
