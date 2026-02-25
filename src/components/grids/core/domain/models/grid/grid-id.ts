import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

export class GridId {
    private readonly value: string;

    private constructor(value: string) {
        this.value = value;
    }

    static create(): GridId {
        return new GridId(uuidv4());
    }

    static from(value: string): GridId {
        if (!uuidValidate(value)) {
            throw new Error(`Invalid GridId: ${value}`);
        }
        return new GridId(value);
    }

    toString(): string {
        return this.value;
    }

    equals(other: GridId): boolean {
        return this.value === other.value;
    }
}
