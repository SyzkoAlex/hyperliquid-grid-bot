import { SerializableEvent } from '@domain/events/trading/trading-event';

export interface NotifyUserParams {
    event: SerializableEvent;
}
