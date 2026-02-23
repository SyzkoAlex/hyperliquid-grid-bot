import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { HttpService } from '@/infra/http/http.service';
import { logger } from '@/infra/logger/logger';
import { Config } from '@/config/config.schema';
import { HyperliquidUserStateResponse } from '@/infra/hyperliqued/types/hyperliquid-user-state-response';
import { HyperliquidSpotMetaResponse } from '@/infra/hyperliqued/types/hyperliquid-spot-meta-response';
import { HyperliquidOpenOrder } from '@/infra/hyperliqued/types/hyperliquid-open-order';
import { HyperliquidOrderStatusResponse } from '@/infra/hyperliqued/types/hyperliquid-order-status-response';
import { HyperliquidUserFillResponse } from '@/infra/hyperliqued/types/hyperliquid-user-fill';
import { L2BookResponse } from '@/infra/hyperliqued/types/hyperliquid-l2-book-response';

/**
 * Hyperliquid API Read Client (Infra Layer)
 *
 * Pure HTTP client for Hyperliquid API read-only operations.
 * Returns raw API responses without domain mapping.
 *
 * Shared between trading and telegram components via infra layer.
 */
@Injectable()
export class HyperliquidApiClient implements OnModuleInit {
    private readonly apiUrl: string;
    private readonly logger = logger.child({ context: HyperliquidApiClient.name });
    private spotMetaCache: HyperliquidSpotMetaResponse | null = null;

    constructor(
        private readonly httpService: HttpService,
        configService: ConfigService<Config, true>,
    ) {
        this.apiUrl = configService.get('hyperliquid', { infer: true }).apiUrl;
    }

    async onModuleInit() {
        await this.refreshSpotMetaCache();
    }

    /**
     * Get user spot state (balances)
     *
     * @param user - User wallet address
     * @returns Raw API response with balances
     */
    async getUserSpotState(user: string): Promise<AxiosResponse<HyperliquidUserStateResponse>> {
        try {
            return await this.httpService.post<HyperliquidUserStateResponse>(
                `${this.apiUrl}/info`,
                {
                    type: 'spotClearinghouseState',
                    user,
                },
            );
        } catch (error) {
            this.logger.error({ error, user }, 'Failed to get user spot state');
            throw error;
        }
    }

    /**
     * Get all mid prices
     *
     * @returns Raw API response with mid prices (symbol -> price)
     */
    async getAllMids(): Promise<AxiosResponse<Record<string, string>>> {
        try {
            return await this.httpService.post<Record<string, string>>(`${this.apiUrl}/info`, {
                type: 'allMids',
            });
        } catch (error) {
            this.logger.error({ error }, 'Failed to get all mids');
            throw error;
        }
    }

    /**
     * Refresh spot meta cache
     * Called on module initialization and can be called manually to refresh
     */
    async refreshSpotMetaCache(): Promise<void> {
        try {
            const spotMeta = await this.getSpotMeta();
            this.spotMetaCache = spotMeta.data;
            this.logger.info(
                { tokensCount: this.spotMetaCache.tokens.length },
                'Spot meta cache refreshed',
            );
        } catch (error) {
            this.logger.error({ error }, 'Failed to refresh spot meta cache');
            throw error;
        }
    }

    /**
     * Get size decimals for a symbol from cached spot meta
     *
     * @param symbol - Symbol string (e.g., 'BTC', 'ETH', 'HYPE')
     * @returns Number of decimal places for order size
     * @throws Error if symbol not found in cache
     */
    getSzDecimals(symbol: string): number {
        if (!this.spotMetaCache) {
            throw new Error('Spot meta cache not initialized');
        }

        this.logger.debug(
            {
                symbol,
                availableTokens: this.spotMetaCache.tokens.map((t) => t.name).slice(0, 10),
            },
            'Getting szDecimals for symbol',
        );

        const token = this.spotMetaCache.tokens.find((t) => t.name === symbol);
        if (!token) {
            this.logger.error(
                {
                    symbol,
                    availableTokens: this.spotMetaCache.tokens.map((t) => t.name),
                },
                'Token not found in spot meta cache',
            );
            throw new Error(`Token not found in spot meta cache: ${symbol}`);
        }

        this.logger.debug({ symbol, szDecimals: token.szDecimals }, 'Found szDecimals');
        return token.szDecimals;
    }

    /**
     * Get spot price for a symbol using getAllMids
     *
     * @param symbol - Symbol string (e.g., 'BTC', 'ETH', 'HYPE')
     * @returns Mid price
     * @throws Error if price not available
     */
    async getSpotPrice(symbol: string): Promise<number> {
        if (!this.spotMetaCache) {
            throw new Error('Spot meta cache not initialized');
        }

        const token = this.spotMetaCache.tokens.find((t) => t.name === symbol);
        if (!token) {
            throw new Error(`Token not found for symbol: ${symbol}`);
        }

        try {
            const universeEntry = this.spotMetaCache.universe.find(
                (u) => u.tokens[0] === token.index,
            );

            if (!universeEntry) {
                throw new Error(`No spot market found for ${symbol}`);
            }

            const mids = await this.getAllMids();
            const spotKey = `@${universeEntry.index}`;
            const priceStr = mids.data[spotKey];

            if (!priceStr) {
                throw new Error(`Price not available for ${symbol}`);
            }

            const price = parseFloat(priceStr);
            this.logger.debug({ symbol, spotKey, price }, 'Spot price from mids');
            return price;
        } catch (error) {
            if (
                error instanceof Error &&
                (error.message.startsWith('Price not available') ||
                    error.message.startsWith('No spot market'))
            ) {
                throw error;
            }
            this.logger.error({ error, symbol }, 'Failed to get spot price');
            throw new Error(`Price not available for ${symbol}`);
        }
    }

    /**
     * Get L2 order book for a trading pair
     *
     * @param coin - Trading pair (e.g., 'HYPE/USDC', 'BTC/USDC')
     * @returns L2 order book with bids and asks
     */
    async getL2Book(coin: string): Promise<AxiosResponse<L2BookResponse>> {
        try {
            return await this.httpService.post<L2BookResponse>(`${this.apiUrl}/info`, {
                type: 'l2Book',
                coin,
            });
        } catch (error) {
            this.logger.error({ error, coin }, 'Failed to get L2 book');
            throw error;
        }
    }

    /**
     * Get spot meta (available tokens)
     *
     * @returns Raw API response with token metadata
     */
    async getSpotMeta(): Promise<AxiosResponse<HyperliquidSpotMetaResponse>> {
        try {
            return await this.httpService.post<HyperliquidSpotMetaResponse>(`${this.apiUrl}/info`, {
                type: 'spotMeta',
            });
        } catch (error) {
            this.logger.error({ error }, 'Failed to get spot meta');
            throw error;
        }
    }

    /**
     * Get open spot orders for a user
     *
     * @param user - User wallet address
     * @returns Raw API response with open orders
     */
    async getOpenSpotOrders(user: string): Promise<AxiosResponse<HyperliquidOpenOrder[]>> {
        try {
            return await this.httpService.post<HyperliquidOpenOrder[]>(`${this.apiUrl}/info`, {
                type: 'openOrders',
                user,
            });
        } catch (error) {
            this.logger.error({ error, user }, 'Failed to get open spot orders');
            throw error;
        }
    }

    /**
     * Query order status by OID or CLOID
     *
     * @param user - User wallet address
     * @param oid - Either numeric order ID or hex string client order ID (cloid)
     * @returns Raw API response with order status or null if not found
     */
    async getOrderStatus(
        user: string,
        oid: number | string,
    ): Promise<AxiosResponse<HyperliquidOrderStatusResponse>> {
        try {
            const resolvedOid =
                typeof oid === 'string' && !oid.startsWith('0x') ? Number(oid) : oid;
            return await this.httpService.post<HyperliquidOrderStatusResponse>(
                `${this.apiUrl}/info`,
                {
                    type: 'orderStatus',
                    user,
                    oid: resolvedOid,
                },
            );
        } catch (error) {
            this.logger.error({ error, user, oid }, 'Failed to get order status');
            throw error;
        }
    }

    /**
     * Get user fills (trade history)
     *
     * @param user - User wallet address
     * @param startTime - Optional start time in milliseconds
     * @returns Raw API response with user fills
     */
    async getUserFills(
        user: string,
        startTime?: number,
    ): Promise<AxiosResponse<HyperliquidUserFillResponse[]>> {
        try {
            return await this.httpService.post<HyperliquidUserFillResponse[]>(
                `${this.apiUrl}/info`,
                {
                    type: 'userFills',
                    user,
                    ...(startTime && { startTime }),
                },
            );
        } catch (error) {
            this.logger.error({ error, user }, 'Failed to get user fills');
            throw error;
        }
    }
}
