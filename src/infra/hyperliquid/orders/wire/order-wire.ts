import { Tif } from './tif';
import { floatToWire } from './float-to-wire';

/**
 * Plain-object wire shape for a Hyperliquid /exchange order.
 * Field names follow Hyperliquid's abbreviated wire format:
 *
 *  - `a`: asset index (numeric spot asset ID)
 *  - `b`: isBuy (true for buys, false for sells)
 *  - `p`: limit price as a wire-formatted string
 *  - `s`: size as a wire-formatted string
 *  - `r`: reduceOnly flag
 *  - `t`: order type payload (limit tif / trigger)
 *  - `c`: optional CLOID — OMITTED when absent (msgpack treats
 *         `undefined` and "missing" differently)
 *
 * Field order is significant: msgpack encoding uses insertion order and
 * Hyperliquid signs the encoded bytes. DO NOT reorder or use a class
 * with getters — rely on plain-object literal insertion order.
 */
export interface OrderWirePayload {
    /** asset index (numeric spot asset ID) */
    a: number;
    /** isBuy (true for buys, false for sells) */
    b: boolean;
    /** limit price as a wire-formatted string */
    p: string;
    /** size as a wire-formatted string */
    s: string;
    /** reduceOnly flag */
    r: boolean;
    /** order type payload (limit tif / trigger) */
    t: { limit: { tif: Tif } };
    /** optional CLOID — OMITTED when absent (msgpack treats `undefined` and "missing" differently) */
    c?: string;
}

export interface OrderWireParams {
    assetIndex: number;
    isBuy: boolean;
    /** Pre-rounded limit price (numeric). */
    price: number;
    /** Pre-rounded size (numeric). */
    size: number;
    tif?: Tif;
    reduceOnly?: boolean;
    cloid?: string;
}

export class OrderWire {
    private constructor() {}

    static create(params: OrderWireParams): OrderWirePayload {
        const base: OrderWirePayload = {
            a: params.assetIndex,
            b: params.isBuy,
            p: floatToWire(params.price),
            s: floatToWire(params.size),
            r: params.reduceOnly ?? false,
            t: { limit: { tif: params.tif ?? Tif.Gtc } },
        };
        if (params.cloid) {
            base.c = params.cloid;
        }
        return base;
    }
}
