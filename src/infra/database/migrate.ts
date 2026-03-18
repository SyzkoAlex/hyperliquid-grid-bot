import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as path from 'path';

async function runMigrations(): Promise<void> {
    const host = process.env.DATABASE_HOST;
    const port = Number(process.env.DATABASE_PORT ?? 5432);
    const user = process.env.DATABASE_USER;
    const password = process.env.DATABASE_PASSWORD;
    const database = process.env.DATABASE_NAME;

    if (!host || !user || !password || !database) {
        console.error('Missing required DATABASE_* env vars');
        process.exit(1);
    }

    const pool = new Pool({ host, port, user, password, database });
    const db = drizzle(pool);

    console.log(`Running migrations on ${database}@${host}...`);
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../../migrations') });
    console.log('Migrations complete');

    await pool.end();
}

runMigrations().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
