import { GridAction } from '@components/telegram/core/domain/models/grid-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';

export class GridsListKeyboard {
    static create(
        items: GridSnapshot[],
        startIndex: number,
        paginationActionFn: (page: number) => string,
        page: number,
        totalPages: number,
    ): InlineButton[][] {
        return [
            ...GridsListKeyboard.detailButtons(items, startIndex, page),
            ...GridsListKeyboard.paginationRow(page, totalPages, paginationActionFn),
        ];
    }

    private static detailButtons(
        items: GridSnapshot[],
        startIndex: number,
        page: number,
    ): InlineButton[][] {
        if (items.length === 0) return [];

        if (items.length === 1) {
            return [
                [{ text: BUTTON_LABELS.DETAILS, action: GridAction.view(items[0].grid.id, page) }],
            ];
        }

        const rows: InlineButton[][] = [];
        for (let i = 0; i < items.length; i += 2) {
            rows.push(
                items.slice(i, i + 2).map((item, j) => ({
                    text: `${EMOJI.SEARCH} ${startIndex + i + j + 1}. Details`,
                    action: GridAction.view(item.grid.id, page),
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
