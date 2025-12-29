/**
 * Grid Created Error Event
 * Published when grid creation fails
 * Contains error information for Telegram notification
 */
export class GridCreatedErrorEvent {
    constructor(
        public readonly chatId: number,
        public readonly error: string,
    ) {}
}
