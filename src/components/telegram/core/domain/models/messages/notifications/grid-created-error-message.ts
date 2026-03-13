import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';

export class GridCreatedErrorMessage {
    readonly text: string;

    private constructor(error: string) {
        this.text =
            `❌ <b>Grid Creation Failed</b>\n\n` +
            `<b>Error:</b> ${error}\n\n` +
            `Please check your balance and parameters, then try again.`;
    }

    static create(error: string): GridCreatedErrorMessage {
        return new GridCreatedErrorMessage(error);
    }

    static fromEvent(event: GridCreatedErrorEvent): GridCreatedErrorMessage {
        return GridCreatedErrorMessage.create(event.error);
    }
}
