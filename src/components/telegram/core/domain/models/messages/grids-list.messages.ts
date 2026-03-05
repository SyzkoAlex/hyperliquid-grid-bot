import { EMOJI } from '../constants/emoji';

export class GridsListMessages {
    static activeHeader(count: number, page?: number, totalPages?: number): string {
        if (count === 0) {
            return `<b>${EMOJI.GREEN_CIRCLE} Active Grids</b>\n\nNo active grids running.`;
        }
        const pageInfo = totalPages && totalPages > 1 ? ` — page ${page}/${totalPages}` : '';
        return `<b>${EMOJI.GREEN_CIRCLE} Active Grids</b> (${count})${pageInfo}`;
    }

    static stoppedHeader(page: number, totalPages: number, totalCount: number): string {
        if (totalCount === 0) {
            return `<b>${EMOJI.ARCHIVE} Stopped Grids</b>\n\nNo stopped grids yet.`;
        }
        const pageInfo = totalPages > 1 ? ` — page ${page}/${totalPages}` : '';
        return `<b>${EMOJI.ARCHIVE} Stopped Grids</b> (${totalCount})${pageInfo}`;
    }
}
