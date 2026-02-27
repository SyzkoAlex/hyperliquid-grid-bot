import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action.enum';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels.constants';

export function backToMenuKeyboard(): InlineButton[][] {
    return [[{ text: BUTTON_LABELS.BACK_TO_MENU, action: TelegramAction.MainMenu }]];
}
