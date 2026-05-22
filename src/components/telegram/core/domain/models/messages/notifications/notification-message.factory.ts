import { SerializableEvent } from '@domain/models/events/trading/trading-event';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';
import { OrderClosedEvent } from '@domain/models/events/trading/order-closed.event';
import { GridCreatedSuccessEvent } from '@domain/models/events/trading/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';
import { GridStopLossTriggeredEvent } from '@domain/models/events/trading/grid-stop-loss-triggered.event';
import { AgentApprovalLostEvent } from '@domain/models/events/trading/agent-approval-lost.event';
import { TelegramMessage } from '../telegram-message';
import { GridCreatedSuccessMessage } from './grid-created-success-message';
import { GridCreatedErrorMessage } from './grid-created-error-message';
import { GridStopLossTriggeredMessage } from './grid-stop-loss-triggered-message';
import { TradeOpenedMessage } from './trade-opened-message';
import { TradeClosedMessage } from './trade-closed-message';
import { AgentApprovalLostMessage } from './agent-approval-lost-message';

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

        if (event instanceof GridStopLossTriggeredEvent) {
            return GridStopLossTriggeredMessage.fromEvent(event);
        }

        if (event instanceof AgentApprovalLostEvent) {
            return AgentApprovalLostMessage.fromEvent(event);
        }

        throw new Error(`Unknown event type: ${event.constructor.name}`);
    }
}
