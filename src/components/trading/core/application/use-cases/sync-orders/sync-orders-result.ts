export class SyncOrdersResult {
    public gridsProcessed: number;
    public fillsDetected: number;
    public refillsPlaced: number;
    public errors: string[];

    constructor(
        gridsProcessed: number = 0,
        fillsDetected: number = 0,
        refillsPlaced: number = 0,
        errors: string[] = [],
    ) {
        this.gridsProcessed = gridsProcessed;
        this.fillsDetected = fillsDetected;
        this.refillsPlaced = refillsPlaced;
        this.errors = errors;
    }

    static empty(): SyncOrdersResult {
        return new SyncOrdersResult();
    }

    update(gridResult: { fills: number; refills: number }): void {
        this.gridsProcessed++;
        this.fillsDetected += gridResult.fills;
        this.refillsPlaced += gridResult.refills;
    }
}
