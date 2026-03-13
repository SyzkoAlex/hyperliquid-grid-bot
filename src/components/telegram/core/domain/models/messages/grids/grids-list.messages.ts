import { EMOJI } from '../../constants/emoji';

export class ActiveGridsHeaderMessage {
    readonly text: string;

    private constructor(count: number, page?: number, totalPages?: number) {
        if (count === 0) {
            this.text = `<b>${EMOJI.GREEN_CIRCLE} Active Grids</b>\n\nNo active grids running.`;
            return;
        }
        const pageInfo = totalPages && totalPages > 1 ? ` — page ${page}/${totalPages}` : '';
        this.text = `<b>${EMOJI.GREEN_CIRCLE} Active Grids</b> (${count})${pageInfo}`;
    }

    static create(count: number, page?: number, totalPages?: number): ActiveGridsHeaderMessage {
        return new ActiveGridsHeaderMessage(count, page, totalPages);
    }
}

export class StoppedGridsHeaderMessage {
    readonly text: string;

    private constructor(page: number, totalPages: number, totalCount: number) {
        if (totalCount === 0) {
            this.text = `<b>${EMOJI.ARCHIVE} Stopped Grids</b>\n\nNo stopped grids yet.`;
            return;
        }
        const pageInfo = totalPages > 1 ? ` — page ${page}/${totalPages}` : '';
        this.text = `<b>${EMOJI.ARCHIVE} Stopped Grids</b> (${totalCount})${pageInfo}`;
    }

    static create(page: number, totalPages: number, totalCount: number): StoppedGridsHeaderMessage {
        return new StoppedGridsHeaderMessage(page, totalPages, totalCount);
    }
}
