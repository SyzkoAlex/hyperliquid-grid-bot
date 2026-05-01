import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { Config, configSchema } from './config.schema';
import { logger } from '@/infra/logger/logger';

/**
 * Expand environment variable placeholders in YAML values
 *
 * Supports formats:
 * - ${ENV_VAR} - required, throws if not set
 * - ${ENV_VAR:default} - optional with default value
 *
 * @example
 * expandEnv('${APP_PORT:3000}') // returns process.env.APP_PORT or '3000'
 * expandEnv('${DATABASE_URL}')   // returns process.env.DATABASE_URL or throws
 */
export function expandEnv(value: unknown): unknown {
    if (typeof value !== 'string') return value;

    // Match ${ENV_VAR} or ${ENV_VAR:default}
    const match = value.match(/^\$\{([^:}]+)(?::([^}]*))?\}$/);
    if (!match) return value;

    const [, envKey, defaultValue] = match;
    const envValue = process.env[envKey];

    if (envValue !== undefined) {
        return envValue;
    }

    if (defaultValue !== undefined) {
        return defaultValue;
    }

    // Required env var not set
    return undefined;
}

/**
 * Recursively expand environment variables in object
 */
function expandObject(obj: unknown): unknown {
    if (Array.isArray(obj)) {
        return obj.map(expandObject).filter((v) => v !== undefined);
    }

    if (obj && typeof obj === 'object') {
        return Object.fromEntries(
            Object.entries(obj)
                .map(([k, v]) => [k, expandObject(v)])
                .filter(([, v]) => v !== undefined),
        );
    }

    return expandEnv(obj);
}

// Singleton cache
let cachedConfig: Config | null = null;

/**
 * Load and validate configuration from YAML file (singleton)
 *
 * 1. Reads config/config.yml
 * 2. Expands ${ENV_VAR:default} placeholders
 * 3. Validates against Zod schema
 * 4. Caches and returns typed Config object
 *
 * @throws Error if config file not found or validation fails
 */
export function loadConfiguration(): Config {
    if (cachedConfig) {
        return cachedConfig;
    }

    const configPath = path.join(process.cwd(), 'config', 'config.yml');

    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}`);
    }

    const fileContents = fs.readFileSync(configPath, 'utf8');
    const rawConfig = yaml.load(fileContents);

    const expandedConfig = expandObject(rawConfig) as Record<string, unknown>;

    const result = configSchema.safeParse(expandedConfig);

    if (!result.success) {
        logger.error(
            {
                errors: result.error.flatten().fieldErrors,
            },
            'Invalid configuration',
        );

        throw new Error(`Invalid configuration: ${result.error.message}`);
    }

    cachedConfig = result.data;
    return cachedConfig;
}
