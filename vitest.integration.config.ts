import { defineConfig } from 'vitest/config';
import path from 'path';
import swc from 'unplugin-swc';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['**/*.integration.spec.ts'],
        testTimeout: 30000, // 30 seconds for API calls
        hookTimeout: 30000,
    },
    plugins: [
        swc.vite({
            module: { type: 'es6' },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@domain': path.resolve(__dirname, './src/core/domain'),
            '@components': path.resolve(__dirname, './src/components'),
            '@apps': path.resolve(__dirname, './src/apps'),
            '@adapters': path.resolve(__dirname, './src/adapters'),
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
});
