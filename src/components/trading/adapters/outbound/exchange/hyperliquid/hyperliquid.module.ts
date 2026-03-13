import { Module } from '@nestjs/common';
import { EXCHANGE_PORT } from '@components/trading/core/application/ports/exchange.port';
import { HyperliquidSdkService } from './hyperliquid-sdk.service';
import { HyperliquidExchangeMapper } from './hyperliquid-exchange.mapper';
import { HyperliquidExchangeAdapter } from './hyperliquid-exchange.adapter';

@Module({
    providers: [
        HyperliquidSdkService,
        HyperliquidExchangeMapper,
        { provide: EXCHANGE_PORT, useClass: HyperliquidExchangeAdapter },
    ],
    exports: [EXCHANGE_PORT],
})
export class HyperliquidModule {}
