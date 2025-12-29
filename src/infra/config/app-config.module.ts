import { DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadConfiguration } from './configuration';

export class AppConfigModule {
    static forRoot(): Promise<DynamicModule> {
        return ConfigModule.forRoot({
            isGlobal: true,
            load: [loadConfiguration],
        });
    }
}
