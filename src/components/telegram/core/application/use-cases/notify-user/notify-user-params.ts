import { SerializableEvent } from '@domain/models/events/trading/trading-event';

export interface NotifyUserParams {
    event: SerializableEvent;
}
