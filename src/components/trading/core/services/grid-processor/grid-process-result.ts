export class GridProcessResult {
    public fills: number;
    public refills: number;

    constructor(fills: number = 0, refills: number = 0) {
        this.fills = fills;
        this.refills = refills;
    }

    static empty(): GridProcessResult {
        return new GridProcessResult();
    }

    incrementFills(value: number = 1): void {
        this.fills += value;
    }

    incrementRefills(value: number = 1): void {
        this.refills += value;
    }
}
