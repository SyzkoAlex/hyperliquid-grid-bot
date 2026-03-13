import DecimalJS from 'decimal.js';

/**
 * Decimal - precise decimal numbers for financial calculations
 * Wraps Decimal.js to avoid floating point errors
 * Use for: prices, amounts, balances, percentages
 */
export class Decimal {
    private readonly value: DecimalJS;

    private constructor(value: DecimalJS) {
        this.value = value;
    }

    static from(value: number | string | DecimalJS): Decimal {
        if (value instanceof DecimalJS) {
            return new Decimal(value);
        }
        return new Decimal(new DecimalJS(value));
    }

    static zero(): Decimal {
        return new Decimal(new DecimalJS(0));
    }

    add(other: Decimal): Decimal {
        return new Decimal(this.value.add(other.value));
    }

    sub(other: Decimal): Decimal {
        return new Decimal(this.value.sub(other.value));
    }

    mul(other: Decimal): Decimal {
        return new Decimal(this.value.mul(other.value));
    }

    div(other: Decimal): Decimal {
        return new Decimal(this.value.div(other.value));
    }

    abs(): Decimal {
        return new Decimal(this.value.abs());
    }

    neg(): Decimal {
        return new Decimal(this.value.neg());
    }

    gt(other: Decimal): boolean {
        return this.value.gt(other.value);
    }

    gte(other: Decimal): boolean {
        return this.value.gte(other.value);
    }

    lt(other: Decimal): boolean {
        return this.value.lt(other.value);
    }

    lte(other: Decimal): boolean {
        return this.value.lte(other.value);
    }

    eq(other: Decimal): boolean {
        return this.value.eq(other.value);
    }

    isZero(): boolean {
        return this.value.isZero();
    }

    isPositive(): boolean {
        return this.value.isPositive();
    }

    isNegative(): boolean {
        return this.value.isNegative();
    }

    toNumber(): number {
        return this.value.toNumber();
    }

    toString(): string {
        return this.value.toString();
    }

    toFixed(decimalPlaces: number = 2): string {
        return this.value.toFixed(decimalPlaces);
    }

    toJSON(): string {
        return this.toString();
    }
}
