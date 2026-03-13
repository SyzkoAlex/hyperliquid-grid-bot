import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Automatically get list of all components (excluding shared)
const componentsDir = path.join(__dirname, 'src/components');
const components = fs.existsSync(componentsDir)
    ? fs
          .readdirSync(componentsDir, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .filter((dirent) => dirent.name !== 'shared')
          .map((dirent) => dirent.name)
    : [];

// Generate rules for each component
const componentRestrictedImportsRules = components.map((component) => {
    const otherComponents = components.filter((c) => c !== component);

    return {
        files: [`src/components/${component}/**/*.ts`],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: otherComponents.map((other) => ({
                        group: [`**/components/${other}/secondary/**`],
                        message: `Components must be independent. Do not import from ${other}/secondary/. Use src/domain/, src/infra/, or src/components/shared/ (as last resort).`,
                    })),
                },
            ],
        },
    };
});

export default [
    eslint.configs.recommended,
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                project: './tsconfig.json',
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
            globals: {
                ...globals.node,
                ...globals.es2021,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            // TypeScript already checks for undefined variables
            'no-undef': 'off',

            // Allow unused vars with _ prefix and constructor parameters
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    // Allow unused constructor parameters (common in NestJS DI)
                    args: 'after-used',
                },
            ],

            // Other rules
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            'no-console': 'warn',
        },
    },
    ...componentRestrictedImportsRules,
    {
        ignores: ['dist', 'node_modules', 'coverage', '*.js', '*.mjs'],
    },
];
