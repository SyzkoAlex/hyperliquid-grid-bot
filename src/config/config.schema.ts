import { z } from 'zod';

// Individual schemas
export { appSchema, type AppConfig } from './schemas/app.schema';
export { databaseSchema, type DatabaseConfig } from './schemas/database.schema';
export { redisSchema, type RedisConfig } from './schemas/redis.schema';
export { hyperliquidSchema, type HyperliquidConfig } from './schemas/hyperliquid.schema';
export { telegramSchema, type TelegramConfig } from './schemas/telegram.schema';
export { ordersSchema, type OrdersConfig } from './schemas/orders.schema';
export { loggingSchema, type LoggingConfig } from './schemas/logging.schema';
export { metricsSchema, type MetricsConfig } from './schemas/metrics.schema';
export { stopLossSchema, type StopLossConfig } from './schemas/stop-loss.schema';

// Import for combined schema
import { appSchema } from './schemas/app.schema';
import { databaseSchema } from './schemas/database.schema';
import { redisSchema } from './schemas/redis.schema';
import { hyperliquidSchema } from './schemas/hyperliquid.schema';
import { telegramSchema } from './schemas/telegram.schema';
import { ordersSchema } from './schemas/orders.schema';
import { loggingSchema } from './schemas/logging.schema';
import { metricsSchema } from './schemas/metrics.schema';
import { stopLossSchema } from './schemas/stop-loss.schema';

// Combined schema
export const configSchema = z.object({
    app: appSchema,
    database: databaseSchema,
    redis: redisSchema,
    hyperliquid: hyperliquidSchema,
    telegram: telegramSchema,
    orders: ordersSchema,
    logging: loggingSchema,
    metrics: metricsSchema,
    stopLoss: stopLossSchema,
});

export type Config = z.infer<typeof configSchema>;
