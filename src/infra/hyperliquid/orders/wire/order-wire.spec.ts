import { describe, it, expect } from 'vitest';
import { OrderWire } from './order-wire';
import { Tif } from './tif';

describe('OrderWire', () => {
    describe('create', () => {
        it('should return keys in exact msgpack order a,b,p,s,r,t when no cloid', () => {
            const wire = OrderWire.create({
                assetIndex: 5,
                isBuy: true,
                price: 1.5,
                size: 10.0,
            });
            expect(Object.keys(wire)).toEqual(['a', 'b', 'p', 's', 'r', 't']);
        });

        it('should append c key last when cloid is supplied', () => {
            const wire = OrderWire.create({
                assetIndex: 5,
                isBuy: true,
                price: 1.5,
                size: 10.0,
                cloid: '0xabc123',
            });
            expect(Object.keys(wire)).toEqual(['a', 'b', 'p', 's', 'r', 't', 'c']);
            expect(wire.c).toBe('0xabc123');
        });

        it('should omit c key entirely when no cloid supplied', () => {
            const wire = OrderWire.create({
                assetIndex: 5,
                isBuy: false,
                price: 2.0,
                size: 5.0,
            });
            expect('c' in wire).toBe(false);
        });

        it('should default r to false and tif to Gtc', () => {
            const wire = OrderWire.create({
                assetIndex: 1,
                isBuy: true,
                price: 10.0,
                size: 1.0,
            });
            expect(wire.r).toBe(false);
            expect(wire.t.limit.tif).toBe(Tif.Gtc);
        });

        it('should apply custom reduceOnly override', () => {
            const wire = OrderWire.create({
                assetIndex: 1,
                isBuy: false,
                price: 10.0,
                size: 1.0,
                reduceOnly: true,
            });
            expect(wire.r).toBe(true);
        });

        it('should apply custom tif override', () => {
            const wire = OrderWire.create({
                assetIndex: 1,
                isBuy: true,
                price: 10.0,
                size: 1.0,
                tif: Tif.Ioc,
            });
            expect(wire.t.limit.tif).toBe(Tif.Ioc);
        });

        it('should set correct asset index, isBuy, price wire string, and size wire string', () => {
            const wire = OrderWire.create({
                assetIndex: 42,
                isBuy: false,
                price: 1234.5,
                size: 0.5,
            });
            expect(wire.a).toBe(42);
            expect(wire.b).toBe(false);
            expect(wire.p).toBe('1234.5');
            expect(wire.s).toBe('0.5');
        });
    });
});
