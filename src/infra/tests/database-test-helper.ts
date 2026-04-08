import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { grids, orders } from '@/infra/database/schema';
import { sql } from 'drizzle-orm';
import path from 'path';
import type { DrizzleDb } from '@/infra/database/drizzle-db';

/**
 * Database Test Helper with Testcontainers
 *
 * Automatically manages PostgreSQL Docker container for integration tests.
 * No manual Docker setup required - container is created and destroyed automatically.
 */
export class DatabaseTestHelper {
    private static container: StartedPostgreSqlContainer | null = null;
    private static connection: Pool | null = null;
    private static db: DrizzleDb | null = null;

    /**
     * Initialize test database with Testcontainers
     * Automatically starts PostgreSQL container if not already running
     */
    static async initialize(): Promise<DrizzleDb> {
        if (this.db) {
            return this.db;
        }

        console.log('🐳 Starting PostgreSQL testcontainer...');

        // Start PostgreSQL container
        this.container = await new PostgreSqlContainer('postgres:16-alpine')
            .withDatabase('test_db')
            .withUsername('test_user')
            .withPassword('test_password')
            .withExposedPorts(5432)
            .withStartupTimeout(120000) // 2 minutes timeout
            .start();

        const connectionString = this.container.getConnectionUri();

        console.log('✅ PostgreSQL container started');
        console.log('📍 Connection:', connectionString.replace(/:[^:@]+@/, ':****@'));

        // Create connection
        this.connection = new Pool({
            connectionString,
            max: 1,
            idleTimeoutMillis: 20000,
            connectionTimeoutMillis: 10000,
        });

        this.db = drizzle(this.connection);

        // Create tables
        await this.createTables();

        return this.db;
    }

    /**
     * Create database tables for tests using Drizzle migrations
     */
    private static async createTables(): Promise<void> {
        if (!this.db || !this.connection) {
            throw new Error('Database not initialized');
        }

        console.log('📋 Running database migrations...');

        // Run Drizzle migrations
        const migrationsFolder = path.resolve(__dirname, '../database/migrations');
        await migrate(this.db, { migrationsFolder });

        console.log('✅ Migrations completed');
    }

    /**
     * Clean up all test data
     */
    static async cleanup(): Promise<void> {
        if (!this.db) {
            return;
        }

        try {
            // Delete in correct order (orders before grids due to potential FK)
            await this.db.delete(orders);
            await this.db.delete(grids);

            console.log('🗑️  Test data cleaned up');
        } catch (error) {
            console.error('❌ Failed to cleanup test data:', error);
        }
    }

    /**
     * Close database connection and stop container
     */
    static async close(): Promise<void> {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
            this.db = null;
            console.log('🔌 Database connection closed');
        }

        if (this.container) {
            await this.container.stop();
            this.container = null;
            console.log('🐳 PostgreSQL container stopped');
        }
    }

    /**
     * Get database instance
     */
    static getDb(): DrizzleDb {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.db;
    }

    /**
     * Get container connection URI
     */
    static getConnectionUri(): string {
        if (!this.container) {
            throw new Error('Container not started');
        }
        return this.container.getConnectionUri();
    }

    /**
     * Check if database is available
     */
    static async isAvailable(): Promise<boolean> {
        try {
            const db = await this.initialize();
            await db.execute(sql`SELECT 1`);
            return true;
        } catch (error) {
            console.error('❌ Database not available:', error);
            return false;
        }
    }
}
