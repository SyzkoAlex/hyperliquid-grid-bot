import { Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { privateKeyToAccount } from 'viem/accounts';
import { HyperliquidHttpClient } from '../http/hyperliquid-http.client';
import { HyperliquidMetaService } from '../meta/hyperliquid-meta.service';
import { signL1Action } from '../signing/hyperliquid-signing';
import { ceilToDecimals, floorToDecimals, roundToDecimals } from './hyperliquid-size-format';
import { OrderWire } from './wire/order-wire';
import { OrderAction } from './wire/order-action';
import { CancelAction } from './wire/cancel-action';
import { PlaceSpotOrderInput } from '../types/hyperliquid-place-spot-order-input';
import { CancelSpotOrderInput } from '../types/hyperliquid-cancel-spot-order-input';
import { HyperliquidSdkPlaceOrderResponse } from '../types/hyperliquid-sdk-place-order-response';

@Injectable()
export class HyperliquidOrdersService {
    private readonly logger = logger.child({ context: HyperliquidOrdersService.name });

    constructor(
        private readonly http: HyperliquidHttpClient,
        private readonly meta: HyperliquidMetaService,
        private readonly isMainnet: boolean,
    ) {}

    async placeSpotOrder(input: PlaceSpotOrderInput): Promise<HyperliquidSdkPlaceOrderResponse> {
        const szDecimals = this.meta.getSzDecimals(input.symbol);
        const size = input.isBuy
            ? floorToDecimals(input.amount, szDecimals)
            : ceilToDecimals(input.amount, szDecimals);
        const limitPx = roundToDecimals(input.price, szDecimals);
        const assetIndex = this.meta.getSpotAssetIndex(input.symbol);

        const wire = OrderWire.create({
            assetIndex,
            isBuy: input.isBuy,
            price: limitPx,
            size,
            cloid: input.cloid,
            tif: input.tif,
        });
        const action = OrderAction.create([wire]);
        const nonce = Date.now();
        const agentAccount = privateKeyToAccount(input.agentPrivateKey as `0x${string}`);
        const signature = await signL1Action(agentAccount, action, nonce, this.isMainnet);

        this.logger.debug({ symbol: input.symbol, size, limitPx }, 'Placing spot order');
        return this.http.postExchange<HyperliquidSdkPlaceOrderResponse>({
            action,
            nonce,
            signature,
        });
    }

    async cancelSpotOrder(input: CancelSpotOrderInput): Promise<{ status: string }> {
        const assetIndex = this.meta.getSpotAssetIndex(input.symbol);
        const action = CancelAction.create([{ a: assetIndex, o: input.exchangeOrderId }]);
        const nonce = Date.now();
        const agentAccount = privateKeyToAccount(input.agentPrivateKey as `0x${string}`);
        const signature = await signL1Action(agentAccount, action, nonce, this.isMainnet);

        this.logger.debug(
            { symbol: input.symbol, oid: input.exchangeOrderId },
            'Cancelling spot order',
        );
        return this.http.postExchange<{ status: string }>({
            action,
            nonce,
            signature,
        });
    }
}
