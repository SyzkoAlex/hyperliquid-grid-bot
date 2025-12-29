import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { createClient, RedisClientType } from 'redis';

/**
 * Cache Test Helper with Testcontainers
 *
 * Automatically manages Redis Docker container for integration tests.
 * No manual Docker setup required - container is created and destroyed automatically.
 */
export class CacheTestHelper {
    private static container: StartedTestContainer | null = null;
    private static client: RedisClientType | null = null;

    /**
     * Initialize test cache with Testcontainers
     * Automatically starts Redis container if not already running
     */
    static async initialize(): Promise<RedisClientType> {
        if (this.client) {
            return this.client;
        }

        console.log('🐳 Starting Redis testcontainer...');

        // Start Redis container
        this.container = await new GenericContainer('redis:7-alpine')
            .withExposedPorts(6379)
            .withStartupTimeout(60000) // 1 minute timeout
            .start();

        const redisHost = this.container.getHost();
        const redisPort = this.container.getMappedPort(6379);
        const redisUrl = `redis://${redisHost}:${redisPort}`;

        console.log('✅ Redis container started');
        console.log('📍 Connection:', redisUrl);

        // Create Redis client
        this.client = createClient({ url: redisUrl });

        this.client.on('error', (err) => {
            console.error('❌ Redis error:', err);
        });

        await this.client.connect();
        console.log('✅ Redis connected successfully');

        return this.client;
    }

    /**
     * Clean up all test data from Redis
     */
    static async cleanup(): Promise<void> {
        if (!this.client) {
            return;
        }

        try {
            await this.client.flushDb();
            console.log('🗑️  Redis test data cleaned up');
        } catch (error) {
            console.error('❌ Failed to cleanup Redis test data:', error);
        }
    }

    /**
     * Close Redis connection and stop container
     */
    static async close(): Promise<void> {
        if (this.client) {
            await this.client.quit();
            this.client = null;
            console.log('🔌 Redis connection closed');
        }

        if (this.container) {
            await this.container.stop();
            this.container = null;
            console.log('🐳 Redis container stopped');
        }
    }

    /**
     * Get Redis client instance
     */
    static getClient(): RedisClientType {
        if (!this.client) {
            throw new Error('Redis not initialized. Call initialize() first.');
        }
        return this.client;
    }

    /**
     * Get connection details
     */
    static getConnectionDetails(): { host: string; port: number } {
        if (!this.container) {
            throw new Error('Container not started');
        }
        return {
            host: this.container.getHost(),
            port: this.container.getMappedPort(6379),
        };
    }

    /**
     * Check if Redis is available
     */
    static async isAvailable(): Promise<boolean> {
        try {
            const client = await this.initialize();
            await client.ping();
            return true;
        } catch (error) {
            console.error('❌ Redis not available:', error);
            return false;
        }
    }
}
