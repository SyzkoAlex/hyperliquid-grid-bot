export class TradingSymbol {
    constructor(private readonly value: string) {
        if (!value || value.trim().length === 0) {
            throw new Error('Symbol cannot be empty');
        }
    }

    toString(): string {
        return this.value;
    }

    /**
     * Convert to Hyperliquid SPOT format (e.g., 'BTC' -> 'BTC-SPOT')
     */
    toSpot(): string {
        return `${this.value}-SPOT`;
    }

    equals(other: TradingSymbol): boolean {
        return this.value === other.value;
    }

    static fromString(value: string): TradingSymbol {
        return new TradingSymbol(value);
    }

    static create(value: string): TradingSymbol {
        return new TradingSymbol(value);
    }
}
