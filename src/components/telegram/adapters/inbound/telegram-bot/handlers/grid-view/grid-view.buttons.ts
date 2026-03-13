import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { GridAction } from '@components/telegram/core/domain/models/grid-action';
import { GridsAction } from '@components/telegram/core/domain/models/grids-action';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { GridStatus } from '@domain/models/grid/grid-status';

export class OrdersTabButton {
    static create(gridId: string, page: number): InlineButton {
        return { text: BUTTON_LABELS.ORDERS, action: GridAction.ordersTab(gridId, page) };
    }
}

export class HistoryTabButton {
    static create(gridId: string, page: number): InlineButton {
        return { text: BUTTON_LABELS.HISTORY, action: GridAction.historyTab(gridId, page) };
    }
}

export class StopGridButton {
    static create(gridId: string): InlineButton {
        return { text: BUTTON_LABELS.STOP, action: GridAction.stop(gridId) };
    }
}

export class BackToGridsButton {
    static create(status: GridStatus, page: number): InlineButton {
        const action =
            status === GridStatus.Running
                ? GridsAction.activePage(page)
                : GridsAction.stoppedPage(page);
        return { text: BUTTON_LABELS.BACK, action };
    }
}

export class BackToGridDetailButton {
    static create(gridId: string, page: number): InlineButton {
        return { text: BUTTON_LABELS.BACK, action: GridAction.view(gridId, page) };
    }
}

export class ConfirmStopButton {
    static create(gridId: string): InlineButton {
        return { text: BUTTON_LABELS.YES_STOP, action: GridAction.confirmStop(gridId) };
    }
}

export class CancelStopButton {
    static create(gridId: string): InlineButton {
        return { text: BUTTON_LABELS.CANCEL, action: GridAction.cancelStop(gridId) };
    }
}

export class BackToGridsListButton {
    static create(): InlineButton {
        return { text: BUTTON_LABELS.BACK, action: TelegramAction.ListGrids };
    }
}
