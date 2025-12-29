export class Symbol {
    constructor(private readonly value: string) {
        if (!value || value.trim().length === 0) {
            throw new Error('Symbol cannot be empty');
        }
    }

    toString(): string {
        return this.value;
    }

    equals(other: Symbol): boolean {
        return this.value === other.value;
    }

    static fromString(value: string): Symbol {
        return new Symbol(value);
    }

    static create(value: string): Symbol {
        return new Symbol(value);
    }
}
