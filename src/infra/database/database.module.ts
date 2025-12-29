import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { DrizzleDb } from './drizzle-db';
import { Config } from '../config/config.schema';
import * as schema from './schema';

export const DRIZZLE_DB = Symbol('DRIZZLE_DB');

@Global()
@Module({
    providers: [
        {
            provide: Pool,
            useFactory: (configService: ConfigService<Config, true>): Pool => {
                const dbConfig = configService.get('database', { infer: true });
                return new Pool({
                    host: dbConfig.host,
                    port: dbConfig.port,
                    user: dbConfig.user,
                    password: dbConfig.password,
                    database: dbConfig.database,
                    max: dbConfig.poolSize,
                    ssl: dbConfig.ssl || false,
                });
            },
            inject: [ConfigService],
        },
        {
            provide: DRIZZLE_DB,
            useFactory: (pool: Pool): DrizzleDb => {
                return drizzle(pool, { schema });
            },
            inject: [Pool],
        },
    ],
    exports: [DRIZZLE_DB],
})
export class DatabaseModule {}
