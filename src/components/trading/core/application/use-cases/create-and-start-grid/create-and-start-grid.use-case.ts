import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { GridStatus } from '@domain/models/grid/grid-status';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';
import { GridDto } from '@components/grids/api/dto/grid.dto';
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
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
        @Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort,
        private readonly capitalCalculator: CapitalCalculatorService,
        private readonly gridLevelsCalculator: GridLevelsCalculatorService,
        private readonly userBalanceExtractor: UserBalanceExtractorService,
        private readonly orderPlacement: OrderPlacementService,
    ) {}

    async execute(params: CreateAndStartGridParams): Promise<CreateAndStartGridResult> {
        this.logger.info({ params }, 'Creating and starting grid');

        const currentPrice = await this.exchange.getCurrentPrice(
            TradingSymbol.create(params.symbol),
        );

        const { investmentUSDC, investmentBase } = await this.getUserBalanceAndCalculateCapital(
            params,
            currentPrice,
        );

        const grid = await this.createAndSaveGrid(
            params,
            investmentUSDC,
            investmentBase,
            currentPrice,
        );

        await this.startGridWithOrders(grid, currentPrice, params.address);

        return new CreateAndStartGridResult(grid, investmentUSDC, investmentBase);
    }

    private async getUserBalanceAndCalculateCapital(
        params: CreateAndStartGridParams,
        currentPrice: Price,
    ): Promise<{ investmentUSDC: Decimal; investmentBase: Decimal }> {
        const userState = await this.exchange.getUserSpotState(params.address);
        const { usdcBalance, baseBalance } = this.userBalanceExtractor.extractBalances(
            userState,
            params.symbol,
        );

        if (baseBalance.isZero()) {
            throw new Error(
                `Cannot create grid: zero ${params.symbol} balance. Grid requires both USDC and ${params.symbol}.`,
            );
        }

        if (usdcBalance.isZero()) {
            throw new Error(
                `Cannot create grid: zero USDC balance. Grid requires both USDC and ${params.symbol}.`,
            );
        }

        const distribution = this.capitalCalculator.calculateDistribution({
            levels: params.levels,
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
        currentPrice: Price,
    ): Promise<GridDto> {
        const user = await this.usersApi.findUserByAccountAddress(params.address);
        if (!user) {
            throw new Error(`User not found for account address: ${params.address}`);
        }

        const grid = await this.grids.createGrid({
            id: uuidv4(),
            userId: user.id,
            symbol: params.symbol,
            lowerPrice: params.lowerPrice,
            upperPrice: params.upperPrice,
            levels: params.levels,
            investmentUSDC: investmentUSDC.toNumber(),
            investmentBase: investmentBase.toNumber(),
            creationPrice: currentPrice.toNumber(),
            trailingEnabled: params.trailingEnabled,
            trailingTriggerPercent: params.trailingTriggerPercent,
            trailingStepPercent: params.trailingStepPercent,
            trailingPartialClosePercent: params.trailingPartialClosePercent,
            stopLossEnabled: params.stopLossEnabled,
            stopLossPrice: params.stopLossPrice,
        });

        this.logger.info({ gridId: grid.id }, 'Grid entity created and saved');

        return grid;
    }

    private async startGridWithOrders(
        grid: GridDto,
        currentPrice: Price,
        accountAddress: string,
    ): Promise<void> {
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
            grid.lowerPrice,
            grid.upperPrice,
            grid.levels,
            grid.investmentUSDC,
            grid.investmentBase,
            currentPrice,
        );

        await this.grids.updateGridStatus(grid.id, GridStatus.Running);

        const placedCount = await this.orderPlacement.placeGridOrders(
            grid,
            levelsWithSizes,
            accountAddress,
        );

        this.logger.info({ gridId: grid.id, placedCount }, 'Grid started successfully');
    }
}
