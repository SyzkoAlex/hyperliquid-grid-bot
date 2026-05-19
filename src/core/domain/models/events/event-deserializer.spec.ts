import { describe, expect, it } from 'vitest';
import { EventDeserializer } from './event-deserializer';
import { EventType } from './event-type';
import { SerializableEvent } from './trading/trading-event';
import { CreateGridCommandEvent } from './commands/create-grid-command.event';
import { StopGridCommandEvent } from './commands/stop-grid-command.event';
import { OrderOpenedEvent } from './trading/order-opened.event';
import { OrderClosedEvent } from './trading/order-closed.event';
import { GridCreatedSuccessEvent } from './trading/grid-created-success.event';
import { GridCreatedErrorEvent } from './trading/grid-created-error.event';
import { GridStopLossTriggeredEvent } from './trading/grid-stop-loss-triggered.event';

function createEventByType(type: EventType): SerializableEvent {
    const factories: Record<EventType, () => SerializableEvent> = {
        [EventType.CreateGridCommand]: () =>
            CreateGridCommandEvent.create({
                symbol: 'BTC',
                lowerPrice: 50000,
                upperPrice: 60000,
                accountAddress: '0xabc',
            }),
        [EventType.StopGridCommand]: () => StopGridCommandEvent.create('grid-1', '0xabc'),
        [EventType.OrderOpened]: () =>
            new OrderOpenedEvent('grid-1', 'BTC', 'buy', 50000, 0.1, 5000, 1, 10),
        [EventType.OrderClosed]: () =>
            new OrderClosedEvent('grid-1', 'BTC', 'sell', 51000, 0.1, 5100, 100, 2, 10),
        [EventType.GridCreatedSuccess]: () =>
            new GridCreatedSuccessEvent('grid-1', 'BTC', 50000, 60000, 10, 5000, 0.5, false),
        [EventType.GridCreatedError]: () =>
            new GridCreatedErrorEvent('Something went wrong', '0xabc'),
        [EventType.GridStopLossTriggered]: () =>
            new GridStopLossTriggeredEvent(
                'grid-1',
                'BTC',
                49000,
                48500,
                0.1,
                4850,
                true,
                undefined,
            ),
    };
    return factories[type]();
}

describe('EventDeserializer', () => {
    const deserializer = new EventDeserializer();

    const allEventTypes = Object.values(EventType);

    it.each(allEventTypes)('handles %s round-trip serialize/deserialize', (eventType) => {
        const original = createEventByType(eventType);
        const json = original.serialize();

        const restored = deserializer.deserialize(eventType, json);

        expect(restored.eventType).toBe(eventType);
        expect(restored.timestamp).toBe(original.timestamp);
    });

    it('has a factory for every EventType (compile-time exhaustiveness)', () => {
        for (const eventType of allEventTypes) {
            expect(() => createEventByType(eventType)).not.toThrow();
        }
    });
});
