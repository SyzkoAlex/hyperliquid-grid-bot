import { EMOJI } from '../../constants/emoji';

interface GridCreatingParams {
    summary: string;
}

export class GridCreatingMessage {
    readonly text: string;

    private constructor({ summary }: GridCreatingParams) {
        this.text =
            `${EMOJI.HOURGLASS} <b>Creating grid...</b>\n\n` +
            (summary ? `${summary}\n\n` : '') +
            `We'll notify you when the grid is ready.`;
    }

    static create(params: GridCreatingParams): GridCreatingMessage {
        return new GridCreatingMessage(params);
    }
}
