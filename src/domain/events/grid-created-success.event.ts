/**
 * Grid Created Success Event
 * Published when grid is successfully created and started
 * Contains detailed information for Telegram notification
 */
export class GridCreatedSuccessEvent {
    constructor(
        public readonly chatId: number,
        public readonly gridId: string,
        public readonly symbol: string,
        public readonly mode: string,
        public readonly lowerPrice: number,
        public readonly upperPrice: number,
        public readonly levels: number,
        public readonly investmentUSDC: number,
        public readonly investmentBase: number,
        public readonly trailingEnabled: boolean,
    ) {}
}
