import { UserStateDto } from './dto/user-state.dto';
import { CapitalDistributionDto } from './dto/capital-distribution.dto';
import { CalculateCapitalDistributionDto } from './dto/calculate-capital-distribution.dto';
import { CalculateMaxInvestmentDto } from './dto/calculate-max-investment.dto';
import { CalculateOptimalSwapDto } from './dto/calculate-optimal-swap.dto';
import { OptimalSwapDto } from './dto/optimal-swap.dto';
import { ExecuteSpotSwapDto } from './dto/execute-spot-swap.dto';
import { SpotSwapResultDto } from './dto/spot-swap-result.dto';
import { TokenDescriptorDto } from './dto/token-descriptor.dto';

export type { TokenDescriptorDto };

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
    /** Calculate the swap that would rebalance the user's portfolio to optimally fit the given grid.
     *  Returns null when no rebalance is needed (already balanced or single-leg grid). */
    calculateOptimalSwap(params: CalculateOptimalSwapDto): OptimalSwapDto | null;
    /** Execute a marketable IOC spot swap. Returns whatever filled — caller must re-fetch balance
     *  to determine the post-swap state. First sync write through this port. */
    executeSpotSwap(params: ExecuteSpotSwapDto): Promise<SpotSwapResultDto>;
    /** Return the minimum notional (in USDC) required to place any spot order. */
    getMinOrderNotional(): number;
    /** Check whether the agent wallet has been approved on-chain for the given account. */
    probeAgentApproval(accountAddress: string): Promise<{ approved: boolean }>;
    /** Return the top tokens by 24h volume with both on-chain symbol and display name. */
    getTopSymbolsByVolume(limit?: number): Promise<TokenDescriptorDto[]>;
}
