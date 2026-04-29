import { UserStateDto } from './dto/user-state.dto';
import { CapitalDistributionDto } from './dto/capital-distribution.dto';
import { CalculateCapitalDistributionDto } from './dto/calculate-capital-distribution.dto';
import { CalculateMaxInvestmentDto } from './dto/calculate-max-investment.dto';

export const TRADING_API_PORT = Symbol('TRADING_API_PORT');

export interface TradingApiPort {
    getCurrentPrice(symbol: string): Promise<number>;
    getCurrentPrices(symbols: string[]): Promise<number[]>;
    getUserSpotState(user: string): Promise<UserStateDto>;
    pairExists(symbol: string): Promise<boolean>;
    calculateCapitalDistribution(params: CalculateCapitalDistributionDto): CapitalDistributionDto;
    calculateMaxInvestment(params: CalculateMaxInvestmentDto): number;
    probeAgentApproval(accountAddress: string): Promise<{ approved: boolean }>;
    notifyAgentActivated(accountAddress: string): void;
}
