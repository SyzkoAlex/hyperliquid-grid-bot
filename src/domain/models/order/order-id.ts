import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

/**
 * OrderId Value Object
 * Represents a unique order identifier
 */
export class OrderId {
    private readonly value: string;

    private constructor(value: string) {
        this.value = value;
    }

    static create(): OrderId {
        return new OrderId(uuidv4());
    }

    static from(value: string): OrderId {
        if (!uuidValidate(value)) {
            throw new Error(`Invalid OrderId: ${value}`);
        }
        return new OrderId(value);
    }

    static fromExchangeId(exchangeId: string): OrderId {
        return new OrderId(exchangeId);
    }

    toString(): string {
        return this.value;
    }

    equals(other: OrderId): boolean {
        return this.value === other.value;
    }
}
