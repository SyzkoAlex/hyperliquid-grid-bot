import { Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { HyperliquidApiClient } from './hyperliquid-api.client';
import { TradingSymbol } from '@domain/models/primitives/trading-symbol';
import { Price } from '@domain/models/primitives/price';
import { UserState } from '@components/trading/core/domain/models/user-state/user-state';
import { HyperliquidInfoMapper } from '@components/trading/adapters/outbound/exchange/hyperliquid/hyperliquid-info-mapper';
/**
 * Shared Hyperliquid Info Client Adapter
 *
 * Provides domain-level access to Hyperliquid API for trading component.
 * Wraps infrastructure layer API client and maps responses to domain models.
 */
@Injectable()
export class HyperliquidInfoClientAdapter {
    private readonly logger = logger.child({ context: HyperliquidInfoClientAdapter.name });

    constructor(
        private readonly apiClient: HyperliquidApiClient,
        private readonly userStateMapper: HyperliquidInfoMapper,
    ) {}

    /**
     * Get user spot state (balances and positions)
     *
     * @param user - User wallet address
     * @returns Domain UserState object with balances and positions
     */
    async getUserSpotState(user: string): Promise<UserState> {
        try {
            const response = await this.apiClient.getUserSpotState(user);
            this.logger.debug({ user }, 'User state retrieved');
            return this.userStateMapper.toUserState(response.data);
        } catch (error) {
            this.logger.error({ error, user }, 'Failed to get user state');
            throw error;
        }
    }

    /**
     * Get current spot price for a symbol
     *
     * @param symbol - Trading symbol
     * @returns Current mid price as domain Price object
     */
    async getCurrentPrice(symbol: TradingSymbol): Promise<Price> {
        try {
            const priceValue = await this.apiClient.getSpotPrice(symbol.toString());
            const price = Price.from(priceValue);

            this.logger.debug(
                { symbol: symbol.toString(), price: price.toNumber() },
                'Current price retrieved',
            );

            return price;
        } catch (error) {
            this.logger.error({ error, symbol: symbol.toString() }, 'Failed to get current price');
            throw error;
        }
    }

    /**
     * Check if a spot trading pair exists
     *
     * @param symbol - Trading symbol to check
     * @returns True if pair exists on the exchange
     */
    async pairExists(symbol: TradingSymbol): Promise<boolean> {
        try {
            const spotMeta = await this.apiClient.getSpotMeta();
            return spotMeta.data.tokens.some((token) => token.name === symbol.toString());
        } catch (error) {
            this.logger.error(
                { error, symbol: symbol.toString() },
                'Failed to check if pair exists',
            );
            throw error;
        }
    }
}
