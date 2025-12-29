import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
    schema: './src/infra/database/schema/*.schema.ts',
    out: './src/infra/database/migrations',
    dialect: 'postgresql',
    dbCredentials: { url: process.env.DATABASE_URL! },
    verbose: true,
    strict: true,
});
