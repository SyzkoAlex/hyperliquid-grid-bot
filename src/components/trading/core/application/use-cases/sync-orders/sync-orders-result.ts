export class SyncOrdersResult {
    public gridsProcessed: number;
    public fillsDetected: number;
    public refillsPlaced: number;
    public stpRecovered: number;
    public levelsRepaired: number;
    public errors: string[];

    constructor(
        gridsProcessed: number = 0,
        fillsDetected: number = 0,
        refillsPlaced: number = 0,
        stpRecovered: number = 0,
        levelsRepaired: number = 0,
        errors: string[] = [],
    ) {
        this.gridsProcessed = gridsProcessed;
        this.fillsDetected = fillsDetected;
        this.refillsPlaced = refillsPlaced;
        this.stpRecovered = stpRecovered;
        this.levelsRepaired = levelsRepaired;
        this.errors = errors;
    }

    static empty(): SyncOrdersResult {
        return new SyncOrdersResult();
    }

    update(gridResult: { fills: number; refills: number; stpRecovered: number }): void {
        this.gridsProcessed++;
        this.fillsDetected += gridResult.fills;
        this.refillsPlaced += gridResult.refills;
        this.stpRecovered += gridResult.stpRecovered;
    }

    addLevelsRepaired(count: number): void {
        this.levelsRepaired += count;
    }
}
