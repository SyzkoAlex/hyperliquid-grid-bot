import { DynamicModule, Module } from '@nestjs/common';
import { loadConfiguration } from '@/config/configuration';
import { GridsModule } from '@components/grids/grids.module';
import { TradingModule } from '@components/trading/trading.module';
import { UsersModule } from '@components/users/users.module';
import { InternalJwtGuard } from './adapters/inbound/http/internal-jwt.guard';
import { WebApiAdapter } from './adapters/inbound/http/web-api.adapter';
import { GetMyGridsUseCase } from './core/application/use-cases/get-my-grids/get-my-grids.use-case';
import { GetMyGridUseCase } from './core/application/use-cases/get-my-grid/get-my-grid.use-case';
import { AuthenticateWebUserUseCase } from './core/application/use-cases/authenticate-web-user/authenticate-web-user.use-case';

@Module({})
export class WebApiModule {
    static forRoot(): DynamicModule {
        if (!loadConfiguration().webApi.enabled) return { module: WebApiModule };
        return {
            module: WebApiModule,
            imports: [GridsModule, TradingModule, UsersModule],
            controllers: [WebApiAdapter],
            providers: [
                InternalJwtGuard,
                AuthenticateWebUserUseCase,
                GetMyGridsUseCase,
                GetMyGridUseCase,
            ],
        };
    }
}
