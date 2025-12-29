export class GridStartedEvent {
    constructor(
        public readonly gridId: string,
        public readonly symbol: string,
        public readonly mode: string,
        public readonly levels: number,
    ) {}
}
