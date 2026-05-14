import { InlineButton } from '@components/telegram/core/domain/models/inline-button';

export interface ActiveGridsView {
    text: string;
    keyboard: InlineButton[][];
    totalCount: number;
}
