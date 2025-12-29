import { describe, it, expect } from 'vitest';
import { ExchangeCloid } from './exchange-cloid';
import { GridId } from '../grid/grid-id';

describe('ExchangeCloid', () => {
    describe('create', () => {
        it('should create exchange order uid from GridId', () => {
            const gridId = GridId.from('550d0a20-2bac-446a-8a2a-dbb1d378f564');
            const cloid = ExchangeCloid.create(gridId);

            expect(cloid.toString()).toBe('0x550d0a202bac446a8a2adbb1d378f564');
        });

        it('should remove all dashes from UUID', () => {
            const gridId = GridId.from('123e4567-e89b-41d4-a156-426614174000');
            const cloid = ExchangeCloid.create(gridId);

            expect(cloid.toString()).toBe('0x123e4567e89b41d4a156426614174000');
        });
    });

    describe('parse', () => {
        it('should parse valid cloid with 0x prefix to GridId', () => {
            const cloidStr = '0x550d0a202bac446a8a2adbb1d378f564';
            const result = ExchangeCloid.parse(cloidStr);

            expect(result).toBeInstanceOf(GridId);
            expect(result?.toString()).toBe('550d0a20-2bac-446a-8a2a-dbb1d378f564');
        });

        it('should parse valid cloid without 0x prefix to GridId', () => {
            const cloidStr = '550d0a202bac446a8a2adbb1d378f564';
            const result = ExchangeCloid.parse(cloidStr);

            expect(result).toBeInstanceOf(GridId);
            expect(result?.toString()).toBe('550d0a20-2bac-446a-8a2a-dbb1d378f564');
        });

        it('should handle different valid UUID formats', () => {
            const cloidStr = '0x123e4567e89b41d4a156426614174000';
            const result = ExchangeCloid.parse(cloidStr);

            expect(result).toBeInstanceOf(GridId);
            expect(result?.toString()).toBe('123e4567-e89b-41d4-a156-426614174000');
        });

        it('should return undefined for undefined cloid', () => {
            const result = ExchangeCloid.parse(undefined);
            expect(result).toBeUndefined();
        });

        it('should return undefined for empty string', () => {
            const result = ExchangeCloid.parse('');
            expect(result).toBeUndefined();
        });

        it('should return undefined for invalid hex format (too short)', () => {
            const cloidStr = '0x550d0a202bac';
            const result = ExchangeCloid.parse(cloidStr);
            expect(result).toBeUndefined();
        });

        it('should return undefined for invalid UUID format', () => {
            const cloidStr = '0xinvalidhexstring123456789012345';
            const result = ExchangeCloid.parse(cloidStr);
            expect(result).toBeUndefined();
        });

        it('should return undefined for non-hex characters', () => {
            const cloidStr = '0x550d0a202bac446a8a2adbb1d378f5zz';
            const result = ExchangeCloid.parse(cloidStr);
            expect(result).toBeUndefined();
        });

        it('should handle cloid with all zeros', () => {
            const cloidStr = '0x00000000000000000000000000000000';
            const result = ExchangeCloid.parse(cloidStr);

            expect(result).toBeInstanceOf(GridId);
            expect(result?.toString()).toBe('00000000-0000-0000-0000-000000000000');
        });

        it('should handle mixed case hex characters', () => {
            const cloidStr = '0x550D0A202BAC446a8A2ADBB1D378F564';
            const result = ExchangeCloid.parse(cloidStr);

            expect(result).toBeInstanceOf(GridId);
            // Case is preserved from the input
            expect(result?.toString()).toBe('550D0A20-2BAC-446a-8A2A-DBB1D378F564');
        });

        it('should round-trip correctly (create then parse)', () => {
            const originalGridId = GridId.from('550d0a20-2bac-446a-8a2a-dbb1d378f564');
            const cloid = ExchangeCloid.create(originalGridId);
            const parsedGridId = ExchangeCloid.parse(cloid.toString());

            expect(parsedGridId).toBeInstanceOf(GridId);
            expect(parsedGridId?.toString()).toBe(originalGridId.toString());
        });
    });
});
