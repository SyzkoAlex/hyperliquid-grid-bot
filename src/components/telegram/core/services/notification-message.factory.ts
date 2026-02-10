import { Injectable } from '@nestjs/common';
import { SerializableEvent } from '@domain/events/trading/trading-event';
import { OrderOpenedEvent } from '@domain/events/trading/order-opened.event';
import { OrderClosedEvent } from '@domain/events/trading/order-closed.event';
import { GridCreatedSuccessEvent } from '@domain/events/trading/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/events/trading/grid-created-error.event';
import { TelegramMessage } from '../domain/messages/telegram-message';
import { GridCreatedSuccessMessage } from '../domain/messages/grid-created-success-message';
import { GridCreatedErrorMessage } from '../domain/messages/grid-created-error-message';
import { TradeOpenedMessage } from '../domain/messages/trade-opened-message';
import { TradeClosedMessage } from '../domain/messages/trade-closed-message';

@Injectable()
export class NotificationMessageFactory {
    buildFromEvent(event: SerializableEvent): TelegramMessage {
        if (event instanceof OrderOpenedEvent) {
            return TradeOpenedMessage.fromEvent(event);
        }

        if (event instanceof OrderClosedEvent) {
            return TradeClosedMessage.fromEvent(event);
        }

        if (event instanceof GridCreatedSuccessEvent) {
            return GridCreatedSuccessMessage.fromEvent(event);
        }

        if (event instanceof GridCreatedErrorEvent) {
            return GridCreatedErrorMessage.fromEvent(event);
        }

        throw new Error(`Unknown event type: ${event.constructor.name}`);
    }
}
