import { Injectable, Inject } from '@nestjs/common';
import {
    EXCHANGE_INFO_PORT,
    ExchangeInfoPort,
} from '@components/trading/core/application/ports/exchange-info.port';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { TradingApiPort } from './trading-api.port';
import { UserStateDto } from './dto/user-state.dto';
import { CapitalDistributionDto } from './dto/capital-distribution.dto';
import { CalculateCapitalDistributionDto } from './dto/calculate-capital-distribution.dto';
import { CapitalCalculatorService } from '@components/trading/core/domain/services/capital-calculator/capital-calculator.service';
import { Decimal } from '@domain/models/primitives/decimal';
import { Price } from '@domain/models/primitives/price';

@Injectable()
export class TradingApiAdapter implements TradingApiPort {
    constructor(
        @Inject(EXCHANGE_INFO_PORT) private readonly info: ExchangeInfoPort,
        private readonly capitalCalculator: CapitalCalculatorService,
    ) {}

    async getCurrentPrice(symbol: string): Promise<number> {
        const price = await this.info.getCurrentPrice(TradingSymbol.fromString(symbol));
        return price.toNumber();
    }

    async getUserSpotState(user: string): Promise<UserStateDto> {
        const userState = await this.info.getUserSpotState(user);
        const usdcBalance = userState.withdrawableBalance.toNumber();
        const spotBalances: Record<string, number> = {};
        for (const pos of userState.assetPositions) {
            spotBalances[pos.symbol.toString()] = pos.size.toNumber();
        }
        return { usdcBalance, spotBalances };
    }

    async pairExists(symbol: string): Promise<boolean> {
        return this.info.pairExists(TradingSymbol.fromString(symbol));
    }

    calculateCapitalDistribution(params: CalculateCapitalDistributionDto): CapitalDistributionDto {
        const distribution = this.capitalCalculator.calculateDistribution({
            mode: params.mode,
            totalInvestmentUSDC: params.totalInvestmentUSDC,
            usdcBalance: Decimal.from(params.usdcBalance),
            baseBalance: Decimal.from(params.baseBalance),
            currentPrice: Price.from(params.currentPrice),
            lowerPrice: params.lowerPrice,
            upperPrice: params.upperPrice,
        });
        return {
            investmentUSDC: distribution.investmentUSDC.toNumber(),
            investmentBase: distribution.investmentBase.toNumber(),
        };
    }
}
