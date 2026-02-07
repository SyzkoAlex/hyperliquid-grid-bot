import { Injectable } from '@nestjs/common';
import { EventType } from '@domain/events/event-type';
import { SerializableEvent } from '@domain/events/trading/trading-event';
import { OrderOpenedEvent } from '@domain/events/trading/order-opened.event';
import { OrderClosedEvent } from '@domain/events/trading/order-closed.event';
import { GridCreatedSuccessEvent } from '@domain/events/trading/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/events/trading/grid-created-error.event';
import { CreateGridCommandEvent } from '@domain/events/commands/create-grid-command.event';

@Injectable()
export class EventDeserializerService {
    deserialize(eventType: EventType, eventJson: string): SerializableEvent {
        switch (eventType) {
            case EventType.CreateGridCommand:
                return CreateGridCommandEvent.deserialize(eventJson);
            case EventType.OrderOpened:
                return OrderOpenedEvent.deserialize(eventJson);
            case EventType.OrderClosed:
                return OrderClosedEvent.deserialize(eventJson);
            case EventType.GridCreatedSuccess:
                return GridCreatedSuccessEvent.deserialize(eventJson);
            case EventType.GridCreatedError:
                return GridCreatedErrorEvent.deserialize(eventJson);
            default:
                throw new Error(`Unknown event type: ${eventType}`);
        }
    }
}
