import { EventType } from '@domain/models/events/event-type';
import { SerializableEvent } from '@domain/models/events/trading/trading-event';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';
import { OrderClosedEvent } from '@domain/models/events/trading/order-closed.event';
import { GridCreatedSuccessEvent } from '@domain/models/events/trading/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';
import { GridStopLossTriggeredEvent } from '@domain/models/events/trading/grid-stop-loss-triggered.event';
import { CreateGridCommandEvent } from '@domain/models/events/commands/create-grid-command.event';
import { StopGridCommandEvent } from '@domain/models/events/commands/stop-grid-command.event';

export class EventDeserializer {
    deserialize(eventType: EventType, eventJson: string): SerializableEvent {
        switch (eventType) {
            case EventType.CreateGridCommand:
                return CreateGridCommandEvent.deserialize(eventJson);
            case EventType.StopGridCommand:
                return StopGridCommandEvent.deserialize(eventJson);
            case EventType.OrderOpened:
                return OrderOpenedEvent.deserialize(eventJson);
            case EventType.OrderClosed:
                return OrderClosedEvent.deserialize(eventJson);
            case EventType.GridCreatedSuccess:
                return GridCreatedSuccessEvent.deserialize(eventJson);
            case EventType.GridCreatedError:
                return GridCreatedErrorEvent.deserialize(eventJson);
            case EventType.GridStopLossTriggered:
                return GridStopLossTriggeredEvent.deserialize(eventJson);
            default:
                throw new Error(`Unknown event type: ${eventType}`);
        }
    }
}
