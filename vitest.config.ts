import { defineConfig } from 'vitest/config';
import path from 'path';
import swc from 'unplugin-swc';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        hookTimeout: 60000,
        testTimeout: 30000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            // v4 dropped `coverage.all`: without `include` only files loaded by tests are reported
            include: ['src/**/*.ts'],
            exclude: [
                'node_modules/',
                'dist/',
                '**/*.config.ts',
                '**/*.d.ts',
                '**/*.spec.ts',
                '**/*.test.ts',
                '**/types/',
            ],
        },
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
            '@utils': path.resolve(__dirname, './src/utils'),
            '@adapters': path.resolve(__dirname, './src/adapters'),
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
});
