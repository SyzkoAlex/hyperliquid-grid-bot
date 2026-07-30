export class DuplicateActiveOrderError extends Error {
    constructor(gridId: string, orderIndex: number, side: string) {
        super(`Active order already exists: grid=${gridId} orderIndex=${orderIndex} side=${side}`);
        this.name = 'DuplicateActiveOrderError';
    }
}
