import { GridAction } from '@components/telegram/core/domain/models/grid-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels.constants';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji.constants';
import { GridWithPnl } from '@components/telegram/core/application/use-cases/get-grids-with-pnl/grid-with-pnl';
import { GridListItemMessage } from '../../messages/grid-list-item.message';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';

interface ListView {
    text: string;
    keyboard: InlineButton[][];
}

export class GridsListView {
    static build(
        header: string,
        items: GridWithPnl[],
        startIndex: number,
        paginationActionFn: (page: number) => string,
        page: number,
        totalPages: number,
    ): ListView {
        return {
            text: GridListItemMessage.list(header, items, startIndex),
            keyboard: [
                ...GridsListView.detailButtons(items, startIndex),
                ...GridsListView.paginationRow(page, totalPages, paginationActionFn),
            ],
        };
    }

    static paginate(items: GridWithPnl[], requestedPage: number, pageSize: number) {
        const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
        const page = Math.min(Math.max(1, requestedPage), totalPages);
        const startIndex = (page - 1) * pageSize;
        return {
            page,
            totalPages,
            startIndex,
            items: items.slice(startIndex, startIndex + pageSize),
        };
    }

    private static detailButtons(items: GridWithPnl[], startIndex: number): InlineButton[][] {
        if (items.length === 0) return [];

        if (items.length === 1) {
            return [[{ text: BUTTON_LABELS.DETAILS, action: GridAction.view(items[0].grid.id) }]];
        }

        const rows: InlineButton[][] = [];
        for (let i = 0; i < items.length; i += 2) {
            rows.push(
                items.slice(i, i + 2).map((item, j) => ({
                    text: `${EMOJI.SEARCH} ${startIndex + i + j + 1}. Details`,
                    action: GridAction.view(item.grid.id),
                })),
            );
        }
        return rows;
    }

    private static paginationRow(
        page: number,
        totalPages: number,
        actionFn: (p: number) => string,
    ): InlineButton[][] {
        if (totalPages <= 1) return [];

        const row: InlineButton[] = [];
        if (page > 1) row.push({ text: '◀', action: actionFn(page - 1) });
        row.push({ text: `${page}/${totalPages}`, action: actionFn(page) });
        if (page < totalPages) row.push({ text: '▶', action: actionFn(page + 1) });
        return [row];
    }
}
