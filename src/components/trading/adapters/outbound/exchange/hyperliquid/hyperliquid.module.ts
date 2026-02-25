import { Module } from '@nestjs/common';
import { HttpModule } from '@/infra/http/http.module';
import { HyperliquidApiClient } from './hyperliquid-api.client';
import { HyperliquidSdkService } from './hyperliquid-sdk.service';
import { HyperliquidSdkClient } from './hyperliquid-sdk.client';
import { HyperliquidWsClient } from './hyperliquid-ws.client';

@Module({
    imports: [HttpModule],
    providers: [
        HyperliquidApiClient,
        HyperliquidSdkService,
        HyperliquidSdkClient,
        HyperliquidWsClient,
    ],
    exports: [
        HyperliquidApiClient,
        HyperliquidSdkService,
        HyperliquidSdkClient,
        HyperliquidWsClient,
    ],
})
export class HyperliquidModule {}
