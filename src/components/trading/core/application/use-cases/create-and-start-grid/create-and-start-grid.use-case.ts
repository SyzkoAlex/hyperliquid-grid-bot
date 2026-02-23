import { Injectable, Inject } from '@nestjs/common';
import {
    EXCHANGE_INFO_PORT,
    ExchangeInfoPort,
} from '@components/trading/core/application/ports/exchange-info.port';
import { GRIDS_PORT, GridsPort } from '@components/grids/core/application/ports/grids.port';
import { CapitalCalculatorService } from '@domain/services/capital-calculator/capital-calculator.service';
import { GridLevelsCalculatorService } from '@components/trading/core/domain/services/grid-levels-calculator/grid-levels-calculator.service';
import { UserBalanceExtractorService } from '@domain/services/user-balance-extractor/user-balance-extractor.service';
import { OrderPlacementService } from '@components/trading/core/application/services/order-placement/order-placement.service';
import { Grid } from '@domain/models/grid/grid';
import { Decimal } from '@domain/models/primitives/decimal';
import { logger } from '@/infra/logger/logger';
import { CreateAndStartGridParams } from './create-and-start-grid-params';
import { CreateAndStartGridResult } from './create-and-start-grid-result';
import { Price } from '@domain/models/primitives/price';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';

@Injectable()
export class CreateAndStartGridUseCase {
    private readonly logger = logger.child({ context: CreateAndStartGridUseCase.name });

    constructor(
        @Inject(EXCHANGE_INFO_PORT) private readonly infoClient: ExchangeInfoPort,
        @Inject(GRIDS_PORT) private readonly grids: GridsPort,
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

        const distribution = this.capitalCalculator.calculateDistribution({
            mode: params.mode,
            totalInvestmentUSDC: params.totalInvestmentUSDC,
            usdcBalance,
            baseBalance,
            currentPrice,
            lowerPrice: params.lowerPrice,
            upperPrice: params.upperPrice,
        });

        if (usdcBalance.lt(distribution.investmentUSDC)) {
            const error = new Error(
                `Insufficient USDC balance. Required: ${distribution.investmentUSDC.toString()}, Available: ${usdcBalance.toString()}`,
            );
            this.logger.error(
                {
                    required: distribution.investmentUSDC.toString(),
                    available: usdcBalance.toString(),
                },
                'Insufficient USDC balance',
            );
            throw error;
        }

        if (baseBalance.lt(distribution.investmentBase)) {
            const error = new Error(
                `Insufficient base token balance. Required: ${distribution.investmentBase.toString()}, Available: ${baseBalance.toString()}`,
            );
            this.logger.error(
                {
                    required: distribution.investmentBase.toString(),
                    available: baseBalance.toString(),
                },
                'Insufficient base token balance',
            );
            throw error;
        }

        return distribution;
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

        await this.grids.saveGrid(grid);
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
        await this.grids.saveGrid(grid);

        const placedCount = await this.orderPlacement.placeGridOrders(grid, levelsWithSizes);

        this.logger.info({ gridId: grid.id.toString(), placedCount }, 'Grid started successfully');
    }
}
