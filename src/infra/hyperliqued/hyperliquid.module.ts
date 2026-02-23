import { Module } from '@nestjs/common';
import { HttpModule } from '@/infra/http/http.module';
import { HyperliquidApiClient } from './hyperliquid-api.client';
import { HyperliquidSdkService } from '@/infra/hyperliqued/hyperliquid-sdk.service';
import { HyperliquidSdkClient } from '@/infra/hyperliqued/hyperliquid-sdk.client';

@Module({
    imports: [HttpModule],
    providers: [HyperliquidApiClient, HyperliquidSdkService, HyperliquidSdkClient],
    exports: [HyperliquidApiClient, HyperliquidSdkService, HyperliquidSdkClient],
})
export class HyperliquidModule {}
