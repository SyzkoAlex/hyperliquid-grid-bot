import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    EXCHANGE_PORT,
    ExchangePort,
} from '@components/trading/core/application/ports/exchange.port';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { TradingApiPort } from './trading-api.port';
import { UserStateDto } from './dto/user-state.dto';
import { CapitalDistributionDto } from './dto/capital-distribution.dto';
import { CalculateCapitalDistributionDto } from './dto/calculate-capital-distribution.dto';
import { CalculateMaxInvestmentDto } from './dto/calculate-max-investment.dto';
import { CalculateOptimalSwapDto } from './dto/calculate-optimal-swap.dto';
import { OptimalSwapDto } from './dto/optimal-swap.dto';
import { ExecuteSpotSwapDto } from './dto/execute-spot-swap.dto';
import { SpotSwapResultDto } from './dto/spot-swap-result.dto';
import { CapitalCalculatorService } from '@components/trading/core/domain/services/capital-calculator/capital-calculator.service';
import { Decimal } from '@domain/models/primitives/decimal';
import { Price } from '@domain/models/primitives/price';
import { Config } from '@/config/config.schema';
import { GetTopSymbolsUseCase } from '@components/trading/core/application/use-cases/get-top-symbols/get-top-symbols.use-case';
import { ExecuteSpotSwapUseCase } from '@components/trading/core/application/use-cases/execute-spot-swap/execute-spot-swap.use-case';
import { TokenDescriptorDto } from './dto/token-descriptor.dto';

@Injectable()
export class TradingApiAdapter implements TradingApiPort {
    private readonly sellSizeBuffer: number;
    private readonly defaultTopSize: number;
    private readonly minOrderNotional: number;

    constructor(
        @Inject(EXCHANGE_PORT) private readonly exchange: ExchangePort,
        private readonly capitalCalculator: CapitalCalculatorService,
        configService: ConfigService<Config, true>,
        private readonly getTopSymbolsUseCase: GetTopSymbolsUseCase,
        private readonly executeSpotSwapUseCase: ExecuteSpotSwapUseCase,
    ) {
        this.sellSizeBuffer = configService.get('hyperliquid.sellSizeBuffer', { infer: true });
        this.defaultTopSize = configService.get('tokens', { infer: true }).topSize;
        // minOrderNotional is used only to expose it via getMinOrderNotional() for
        // the Telegram layer; the execute use case reads it directly from config.
        this.minOrderNotional = configService.get('hyperliquid', { infer: true }).minOrderNotional;
    }

    async getCurrentPrice(symbol: string): Promise<number> {
        const price = await this.exchange.getCurrentPrice(TradingSymbol.fromString(symbol));
        return price.toNumber();
    }

    async getCurrentPrices(symbols: string[]): Promise<number[]> {
        return Promise.all(symbols.map((s) => this.getCurrentPrice(s)));
    }

    async getUserSpotState(user: string): Promise<UserStateDto> {
        const userState = await this.exchange.getUserSpotState(user);
        const usdcBalance = userState.withdrawableBalance.toNumber();
        const usdc = {
            available: usdcBalance,
            total: userState.usdcTotal.toNumber(),
            hold: userState.usdcHold.toNumber(),
        };
        const spotBalances: Record<string, number> = {};
        const spotPositions: Record<string, { available: number; total: number; hold: number }> =
            {};
        for (const pos of userState.assetPositions) {
            const symbol = pos.symbol.toString();
            spotBalances[symbol] = pos.size.toNumber();
            spotPositions[symbol] = {
                available: pos.size.toNumber(),
                total: pos.total.toNumber(),
                hold: pos.hold.toNumber(),
            };
        }
        return { usdcBalance, usdc, spotBalances, spotPositions };
    }

    async pairExists(symbol: string): Promise<boolean> {
        return this.exchange.pairExists(TradingSymbol.fromString(symbol));
    }

    async probeAgentApproval(accountAddress: string): Promise<{ approved: boolean }> {
        return this.exchange.probeAgentApproval(accountAddress);
    }

    calculateCapitalDistribution(params: CalculateCapitalDistributionDto): CapitalDistributionDto {
        const szDecimals = this.exchange.getSzDecimals(TradingSymbol.fromString(params.symbol));
        const distribution = this.capitalCalculator.calculateDistribution({
            levels: params.levels,
            totalInvestmentUSDC: params.totalInvestmentUSDC,
            usdcBalance: Decimal.from(params.usdcBalance),
            baseBalance: Decimal.from(params.baseBalance),
            currentPrice: Price.from(params.currentPrice),
            lowerPrice: params.lowerPrice,
            upperPrice: params.upperPrice,
            sellSizeBuffer: this.sellSizeBuffer,
            szDecimals,
        });
        return {
            requiredUSDC: distribution.requiredUSDC.toNumber(),
            requiredBase: distribution.requiredBase.toNumber(),
        };
    }

    calculateMaxInvestment(params: CalculateMaxInvestmentDto): number {
        const szDecimals = this.exchange.getSzDecimals(TradingSymbol.fromString(params.symbol));
        return this.capitalCalculator.calculateMaxInvestment({
            usdcBalance: Decimal.from(params.usdcBalance),
            baseBalance: Decimal.from(params.baseBalance),
            currentPrice: Price.from(params.currentPrice),
            lowerPrice: params.lowerPrice,
            upperPrice: params.upperPrice,
            levels: params.levels,
            sellSizeBuffer: this.sellSizeBuffer,
            szDecimals,
        });
    }

    calculateOptimalSwap(params: CalculateOptimalSwapDto): OptimalSwapDto | null {
        const result = this.capitalCalculator.calculateOptimalSwap({
            usdcBalance: Decimal.from(params.usdcBalance),
            baseBalance: Decimal.from(params.baseBalance),
            currentPrice: Price.from(params.currentPrice),
            lowerPrice: params.lowerPrice,
            upperPrice: params.upperPrice,
            levels: params.levels,
        });
        if (!result) return null;
        return {
            side: result.side,
            amountUsdc: result.amountUsdc,
            expectedReceived: result.expectedReceived,
        };
    }

    async executeSpotSwap(params: ExecuteSpotSwapDto): Promise<SpotSwapResultDto> {
        return this.executeSpotSwapUseCase.execute({
            symbol: params.symbol,
            side: params.side,
            amountUsdc: params.amountUsdc,
            accountAddress: params.accountAddress,
        });
    }

    async getTopSymbolsByVolume(limit?: number): Promise<TokenDescriptorDto[]> {
        return this.getTopSymbolsUseCase.execute(limit ?? this.defaultTopSize);
    }

    getMinOrderNotional(): number {
        return this.minOrderNotional;
    }
}
