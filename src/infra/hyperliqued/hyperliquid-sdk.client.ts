import { Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { extractErrorDetails } from '@/infra/logger/error-logger.helper';
import { HyperliquidSdkService } from './hyperliquid-sdk.service';
import { HyperliquidSdkPlaceOrderResponse } from '@/infra/hyperliqued/types/hyperliquid-sdk-place-order-response';

@Injectable()
export class HyperliquidSdkClient {
    private readonly logger = logger.child({ context: HyperliquidSdkClient.name });

    constructor(private readonly sdkService: HyperliquidSdkService) {}

    async placeSpotOrder(orderRequest: {
        coin: string;
        is_buy: boolean;
        sz: number;
        limit_px: number;
        order_type: { limit: { tif: 'Gtc' } };
        reduce_only: boolean;
        cloid?: string;
    }): Promise<HyperliquidSdkPlaceOrderResponse> {
        try {
            const sdk = this.sdkService.getSdk();

            this.logger.debug(orderRequest, 'Placing order via SDK');

            const response = await sdk.exchange.placeOrder(orderRequest);

            this.logger.info({ orderRequest, response }, 'Order placed');

            return response;
        } catch (error) {
            this.logger.error(
                { ...extractErrorDetails(error), orderRequest },
                'Failed to place order',
            );
            throw error;
        }
    }

    async cancelSpotOrder(symbol: string, exchangeOrderId: string): Promise<{ status: string }> {
        try {
            const sdk = this.sdkService.getSdk();
            const cancelRequest = {
                coin: symbol,
                o: Number(exchangeOrderId),
            };

            this.logger.debug(cancelRequest, 'Cancelling order via SDK');

            const response = await sdk.exchange.cancelOrder(cancelRequest);

            this.logger.info({ symbol, exchangeOrderId, response }, 'Order cancelled');

            return response;
        } catch (error) {
            this.logger.error(
                { ...extractErrorDetails(error), symbol, exchangeOrderId },
                'Failed to cancel order',
            );
            throw error;
        }
    }
}
