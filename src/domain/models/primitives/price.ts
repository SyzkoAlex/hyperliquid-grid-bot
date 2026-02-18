export class Price {
    constructor(private readonly value: number) {
        if (value < 0) {
            throw new Error('Price cannot be negative');
        }
    }

    toNumber(): number {
        return this.value;
    }

    equals(other: Price): boolean {
        return this.value === other.value;
    }

    gt(other: Price): boolean {
        return this.value > other.value;
    }

    gte(other: Price): boolean {
        return this.value >= other.value;
    }

    lt(other: Price): boolean {
        return this.value < other.value;
    }

    mul(factor: number): Price {
        return new Price(this.value * factor);
    }

    div(divisor: number): Price {
        if (divisor === 0) {
            throw new Error('Cannot divide by zero');
        }
        return new Price(this.value / divisor);
    }

    add(other: Price): Price {
        return new Price(this.value + other.value);
    }

    sub(other: Price): Price {
        return new Price(this.value - other.value);
    }

    static from(value: number): Price {
        return new Price(value);
    }

    static zero(): Price {
        return new Price(0);
    }

    toString(): string {
        return this.value.toString();
    }
}
