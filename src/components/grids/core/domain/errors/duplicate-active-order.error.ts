export class DuplicateActiveOrderError extends Error {
    constructor(gridId: string, levelIndex: number, side: string) {
        super(`Active order already exists: grid=${gridId} level=${levelIndex} side=${side}`);
        this.name = 'DuplicateActiveOrderError';
    }
}
