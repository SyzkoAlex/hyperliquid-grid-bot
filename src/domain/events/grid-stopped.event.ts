export class GridStoppedEvent {
    constructor(
        public readonly gridId: string,
        public readonly symbol: string,
        public readonly reason: string,
    ) {}
}
