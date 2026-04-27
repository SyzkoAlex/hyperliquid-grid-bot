import { Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { HyperliquidHttpClient } from '../http/hyperliquid-http.client';
import { isHttpError } from '../http/hyperliquid-http-error';
import { HyperliquidOpenOrder } from '../types/hyperliquid-open-order';
import { HyperliquidOrderStatusResponse } from '../types/hyperliquid-order-status-response';
import { HyperliquidUserStateResponse } from '../types/hyperliquid-user-state-response';
import { UserFills } from '../types/user-fills';

@Injectable()
export class HyperliquidInfoService {
    private readonly logger = logger.child({ context: HyperliquidInfoService.name });

    constructor(private readonly http: HyperliquidHttpClient) {}

    async getAllMids(): Promise<Record<string, string>> {
        return this.http.postInfo<Record<string, string>>({ type: 'allMids' });
    }

    async getOpenOrders(user: string): Promise<HyperliquidOpenOrder[]> {
        return this.http.postInfo<HyperliquidOpenOrder[]>({ type: 'openOrders', user });
    }

    async getOrderStatus(
        user: string,
        oid: number,
    ): Promise<HyperliquidOrderStatusResponse | null> {
        try {
            const response = await this.http.postInfo<HyperliquidOrderStatusResponse>({
                type: 'orderStatus',
                user,
                oid,
            });
            if (!response) return null;
            if (response.status === 'unknownOid') return null;
            return response;
        } catch (error) {
            if (isHttpError(error, 422)) {
                this.logger.debug({ user, oid }, 'Order status 422, treating as not found');
                return null;
            }
            throw error;
        }
    }

    async getUserFills(user: string, startTime: number, endTime: number): Promise<UserFills> {
        return this.http.postInfo<UserFills>({ type: 'userFillsByTime', user, startTime, endTime });
    }

    async getSpotClearinghouseState(user: string): Promise<HyperliquidUserStateResponse> {
        return this.http.postInfo<HyperliquidUserStateResponse>({
            type: 'spotClearinghouseState',
            user,
        });
    }
}
