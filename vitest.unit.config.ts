import { defineConfig } from 'vitest/config';
import path from 'path';
import swc from 'unplugin-swc';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/*.integration.spec.ts',
            '**/*.e2e.spec.ts',
        ],
        include: ['**/*.spec.ts'],
        testTimeout: 10000,
    },
    plugins: [
        swc.vite({
            module: { type: 'es6' },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@domain': path.resolve(__dirname, './src/domain'),
            '@infra': path.resolve(__dirname, './src/infra'),
            '@components': path.resolve(__dirname, './src/components'),
            '@apps': path.resolve(__dirname, './src/apps'),
            '@utils': path.resolve(__dirname, './src/utils'),
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
});
