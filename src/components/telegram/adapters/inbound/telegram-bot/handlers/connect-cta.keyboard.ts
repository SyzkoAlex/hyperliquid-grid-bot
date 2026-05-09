import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { TelegramAction } from '@components/telegram/core/domain/models/telegram-action';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';

export function connectCtaKeyboard(): InlineButton[][] {
    return [[{ text: BUTTON_LABELS.CONNECT, action: TelegramAction.ConnectAccount }]];
}
