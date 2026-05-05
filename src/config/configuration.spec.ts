import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { expandEnv, expandObject } from './configuration';

describe('expandEnv', () => {
    beforeEach(() => {
        process.env['TEST_EXPAND_VAR'] = 'hello';
    });

    afterEach(() => {
        delete process.env['TEST_EXPAND_VAR'];
        delete process.env['TEST_EXPAND_EMPTY'];
    });

    it('should return the env variable value when ${VAR} is set', () => {
        const result = expandEnv('${TEST_EXPAND_VAR}');
        expect(result).toBe('hello');
    });

    it('should return the default value when env var is not set and default is provided', () => {
        const result = expandEnv('${TEST_EXPAND_MISSING:fallback}');
        expect(result).toBe('fallback');
    });

    it('should return undefined when env var is not set and no default is provided', () => {
        const result = expandEnv('${TEST_EXPAND_MISSING}');
        expect(result).toBeUndefined();
    });

    it('should return the original string when it is not a ${VAR} placeholder', () => {
        const result = expandEnv('plain-string');
        expect(result).toBe('plain-string');
    });

    it('should return non-string values unchanged', () => {
        expect(expandEnv(42)).toBe(42);
        expect(expandEnv(true)).toBe(true);
        expect(expandEnv(null)).toBe(null);
    });

    it('should prefer actual env var over default when both exist', () => {
        const result = expandEnv('${TEST_EXPAND_VAR:default}');
        expect(result).toBe('hello');
    });

    it('should return empty string default when specified', () => {
        const result = expandEnv('${TEST_EXPAND_MISSING:}');
        expect(result).toBe('');
    });
});

describe('expandObject', () => {
    it('should remove keys whose env var is unset and has no default', () => {
        const result = expandObject({ allowedUserId: '${TEST_EXPAND_MISSING}', foo: 'bar' });
        expect(result).toEqual({ foo: 'bar' });
    });

    it('should keep keys whose env var resolves to empty string via ${VAR:} default', () => {
        const result = expandObject({ allowedUserId: '${TEST_EXPAND_MISSING:}' });
        expect(result).toEqual({ allowedUserId: '' });
    });
});
