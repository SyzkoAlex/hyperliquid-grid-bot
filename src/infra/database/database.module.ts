import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { DrizzleDb } from './drizzle-db';
import { Config } from '@/config/config.schema';
import { logger } from '@/infra/logger/logger';
import * as schema from './schema';

export const DRIZZLE_DB = Symbol('DRIZZLE_DB');

@Global()
@Module({
    providers: [
        {
            provide: Pool,
            useFactory: (configService: ConfigService<Config, true>): Pool => {
                const dbConfig = configService.get('database', { infer: true });
                const pool = new Pool({
                    host: dbConfig.host,
                    port: dbConfig.port,
                    user: dbConfig.user,
                    password: dbConfig.password,
                    database: dbConfig.database,
                    max: dbConfig.poolSize,
                    ssl: dbConfig.ssl || false,
                    idleTimeoutMillis: 30_000,
                    connectionTimeoutMillis: 5_000,
                });
                pool.on('error', (err) => {
                    logger.error({ err, context: DatabaseModule.name }, 'pg pool error');
                });
                return pool;
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
