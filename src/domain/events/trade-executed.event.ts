export class TradeExecutedEvent {
    constructor(
        public readonly gridId: string,
        public readonly symbol: string,
        public readonly side: string,
        public readonly price: number,
        public readonly amount: number,
        public readonly total: number,
        public readonly profit: number | null,
        public readonly level: number,
        public readonly totalLevels: number,
    ) {}
}
