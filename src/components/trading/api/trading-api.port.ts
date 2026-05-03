import { UserStateDto } from './dto/user-state.dto';
import { CapitalDistributionDto } from './dto/capital-distribution.dto';
import { CalculateCapitalDistributionDto } from './dto/calculate-capital-distribution.dto';
import { CalculateMaxInvestmentDto } from './dto/calculate-max-investment.dto';

export const TRADING_API_PORT = Symbol('TRADING_API_PORT');

export interface TradingApiPort {
    /** Return the current mid-price for a trading pair (e.g. "BTC/USDC"). */
    getCurrentPrice(symbol: string): Promise<number>;
    /** Return the current mid-prices for multiple trading pairs in the same order as the input. */
    getCurrentPrices(symbols: string[]): Promise<number[]>;
    /** Return the spot balances and open positions for a Hyperliquid account address. */
    getUserSpotState(user: string): Promise<UserStateDto>;
    /** Return true if the given trading pair exists on the exchange. */
    pairExists(symbol: string): Promise<boolean>;
    /** Calculate how capital should be distributed across grid levels. */
    calculateCapitalDistribution(params: CalculateCapitalDistributionDto): CapitalDistributionDto;
    /** Calculate the maximum investable amount given account balance and grid parameters. */
    calculateMaxInvestment(params: CalculateMaxInvestmentDto): number;
    /** Check whether the agent wallet has been approved on-chain for the given account. */
    probeAgentApproval(accountAddress: string): Promise<{ approved: boolean }>;
}
