import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { GridStatus } from '@domain/models/grid/grid-status';
import {
    EXCHANGE_INFO_PORT,
    ExchangeInfoPort,
} from '@components/trading/core/application/ports/exchange-info.port';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { GridDto } from '@/components/grids/api/dto/grid.dto';
import { CapitalCalculatorService } from '@components/trading/core/domain/services/capital-calculator/capital-calculator.service';
import { GridLevelsCalculatorService } from '@components/trading/core/domain/services/grid-levels-calculator/grid-levels-calculator.service';
import { UserBalanceExtractorService } from '@components/trading/core/domain/services/user-balance-extractor/user-balance-extractor.service';
import { OrderPlacementService } from '@components/trading/core/application/services/order-placement/order-placement.service';
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
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        private readonly capitalCalculator: CapitalCalculatorService,
        private readonly gridLevelsCalculator: GridLevelsCalculatorService,
        private readonly userBalanceExtractor: UserBalanceExtractorService,
        private readonly orderPlacement: OrderPlacementService,
    ) {}

    async execute(params: CreateAndStartGridParams): Promise<CreateAndStartGridResult> {
        this.logger.info({ params }, 'Creating and starting grid');

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
            throw new Error(
                `Insufficient USDC balance. Required: ${distribution.investmentUSDC.toString()}, Available: ${usdcBalance.toString()}`,
            );
        }

        if (baseBalance.lt(distribution.investmentBase)) {
            throw new Error(
                `Insufficient base token balance. Required: ${distribution.investmentBase.toString()}, Available: ${baseBalance.toString()}`,
            );
        }

        return distribution;
    }

    private async createAndSaveGrid(
        params: CreateAndStartGridParams,
        investmentUSDC: Decimal,
        investmentBase: Decimal,
    ): Promise<GridDto> {
        const grid = await this.grids.createGrid({
            id: uuidv4(),
            symbol: params.symbol,
            mode: params.mode,
            lowerPrice: params.lowerPrice,
            upperPrice: params.upperPrice,
            levels: params.levels,
            investmentUSDC: investmentUSDC.toNumber(),
            investmentBase: investmentBase.toNumber(),
            trailingEnabled: params.trailingEnabled,
            trailingTriggerPercent: params.trailingTriggerPercent,
            trailingStepPercent: params.trailingStepPercent,
            trailingPartialClosePercent: params.trailingPartialClosePercent,
        });

        this.logger.info({ gridId: grid.id }, 'Grid entity created and saved');

        return grid;
    }

    private async startGridWithOrders(grid: GridDto, currentPrice: Price): Promise<void> {
        this.logger.info(
            {
                symbol: grid.symbol,
                currentPrice: currentPrice.toNumber(),
                lowerPrice: grid.lowerPrice,
                upperPrice: grid.upperPrice,
            },
            'Using current market price for grid',
        );

        const levelsWithSizes = this.gridLevelsCalculator.calculateLevelsWithSizes(
            grid,
            currentPrice,
        );

        await this.grids.updateGridStatus(grid.id, GridStatus.Running);

        const placedCount = await this.orderPlacement.placeGridOrders(grid, levelsWithSizes);

        this.logger.info({ gridId: grid.id, placedCount }, 'Grid started successfully');
    }
}
