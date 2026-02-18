import { defineConfig } from 'vitest/config';
import path from 'path';
import swc from 'unplugin-swc';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'dist/',
                '**/*.config.ts',
                '**/*.d.ts',
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
            '@domain': path.resolve(__dirname, './src/domain'),
            '@infra': path.resolve(__dirname, './src/infra'),
            '@components': path.resolve(__dirname, './src/components'),
            '@apps': path.resolve(__dirname, './src/apps'),
            '@utils': path.resolve(__dirname, './src/utils'),
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
});
