import { Injectable } from '@nestjs/common';
import { HyperliquidInfoClient } from '@components/shared/secondary/clients/hyperliquid-info.client';
import { PostgresGridRepository } from '../../../secondary/repository/grid/postgres-grid.repository';
import { CapitalCalculatorService } from '@components/shared/core/services/capital-calculator/capital-calculator.service';
import { GridLevelsCalculatorService } from '../../services/grid-levels-calculator/grid-levels-calculator.service';
import { UserBalanceExtractorService } from '@components/shared/core/services/user-balance-extractor/user-balance-extractor.service';
import { OrderPlacementService } from '../../services/order-placement/order-placement.service';
import { Grid } from '@domain/grid/grid';
import { Decimal } from '../../../../../domain/primitives/decimal';
import { logger } from '../../../../../infra/logger/logger';
import { CreateAndStartGridParams } from './create-and-start-grid-params';
import { CreateAndStartGridResult } from './create-and-start-grid-result';
import { Price } from '@domain/primitives/price';
import { TradingSymbol } from '@domain/primitives/trading-symbol';

@Injectable()
export class CreateAndStartGridUseCase {
    private readonly logger = logger.child({ context: CreateAndStartGridUseCase.name });

    constructor(
        private readonly infoClient: HyperliquidInfoClient,
        private readonly gridRepository: PostgresGridRepository,
        private readonly capitalCalculator: CapitalCalculatorService,
        private readonly gridLevelsCalculator: GridLevelsCalculatorService,
        private readonly userBalanceExtractor: UserBalanceExtractorService,
        private readonly orderPlacement: OrderPlacementService,
    ) {}

    async execute(params: CreateAndStartGridParams): Promise<CreateAndStartGridResult> {
        this.logger.info({ params }, 'Creating and starting grid');

        // Fetch the current market price early - needed for accurate capital calculation
        const currentPrice = await this.infoClient.getCurrentPrice(
            TradingSymbol.create(params.symbol),
        );

        const { investmentUSDC, investmentBase } = await this.getUserBalanceAndCalculateCapital(
            params,
            currentPrice,
        );

        const grid = await this.createAndSaveGrid(params, investmentUSDC, investmentBase);

        await this.startGridWithOrders(grid, currentPrice);

        return new CreateAndStartGridResult(grid, investmentUSDC, investmentBase);
    }

    private async getUserBalanceAndCalculateCapital(
        params: CreateAndStartGridParams,
        currentPrice: Price,
    ): Promise<{ investmentUSDC: Decimal; investmentBase: Decimal }> {
        const userState = await this.infoClient.getUserSpotState(params.address);
        const { usdcBalance, baseBalance } = this.userBalanceExtractor.extractBalances(
            userState,
            params.symbol,
        );

        return this.capitalCalculator.calculateDistribution({
            mode: params.mode,
            totalInvestmentUSDC: params.totalInvestmentUSDC,
            usdcBalance,
            baseBalance,
            currentPrice,
            lowerPrice: params.lowerPrice,
            upperPrice: params.upperPrice,
        });
    }

    private async createAndSaveGrid(
        params: CreateAndStartGridParams,
        investmentUSDC: Decimal,
        investmentBase: Decimal,
    ): Promise<Grid> {
        const grid = Grid.create({
            symbol: TradingSymbol.create(params.symbol),
            mode: params.mode,
            lowerPrice: Price.from(params.lowerPrice),
            upperPrice: Price.from(params.upperPrice),
            levels: params.levels,
            investmentUSDC,
            investmentBase,
            trailingEnabled: params.trailingEnabled,
            trailingTriggerPercent: params.trailingTriggerPercent,
            trailingStepPercent: params.trailingStepPercent,
            trailingPartialClosePercent: params.trailingPartialClosePercent,
        });

        await this.gridRepository.save(grid);
        this.logger.info({ gridId: grid.id.toString() }, 'Grid entity created and saved');

        return grid;
    }

    private async startGridWithOrders(grid: Grid, currentPrice: Price): Promise<void> {
        this.logger.info(
            {
                symbol: grid.symbol.toString(),
                currentPrice: currentPrice.toNumber(),
                lowerPrice: grid.lowerPrice.toNumber(),
                upperPrice: grid.upperPrice.toNumber(),
            },
            'Using current market price for grid',
        );

        const levelsWithSizes = this.gridLevelsCalculator.calculateLevelsWithSizes(
            grid,
            currentPrice,
        );

        grid.start();

        // Save grid after starting to persist the status change
        await this.gridRepository.save(grid);

        const placedCount = await this.orderPlacement.placeGridOrders(grid, levelsWithSizes);

        this.logger.info({ gridId: grid.id.toString(), placedCount }, 'Grid started successfully');
    }
}
