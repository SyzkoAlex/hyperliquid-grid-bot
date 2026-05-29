import { Price } from '@domain/models/primitives/price';

export class L2Touch {
    constructor(
        readonly bestBid: Price,
        readonly bestAsk: Price,
    ) {}

    static from(bestBid: Price, bestAsk: Price): L2Touch {
        return new L2Touch(bestBid, bestAsk);
    }
}
