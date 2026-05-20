import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { InProcessEventBus } from '@/infra/events/in-process-event-bus';
import { InProcessEventBusModule } from '@/infra/events/in-process-event-bus.module';
import { EventPublisherAdapter } from './event-publisher.adapter';
import {
    EVENT_PUBLISHER_PORT,
    EventPublisherPort,
} from '@/core/application/ports/outbound/event-publisher.port';
import { EventType } from '@domain/models/events/event-type';
import { SerializableEvent } from '@domain/models/events/trading/trading-event';

class TestEvent extends SerializableEvent {
    constructor(public readonly data: string) {
        super(EventType.GridCreatedSuccess, 'user-1');
    }

    protected toJSON() {
        return { data: this.data };
    }
}

describe('EventPublisherAdapter (Integration)', () => {
    let module: TestingModule;
    let publisher: EventPublisherPort;
    let bus: InProcessEventBus;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [InProcessEventBusModule],
            providers: [
                {
                    provide: EVENT_PUBLISHER_PORT,
                    useClass: EventPublisherAdapter,
                },
            ],
        }).compile();

        publisher = module.get<EventPublisherPort>(EVENT_PUBLISHER_PORT);
        bus = module.get(InProcessEventBus);
    });

    afterAll(async () => {
        await module.close();
    });

    it('should deliver event to registered handler', async () => {
        const received: unknown[] = [];
        bus.on(EventType.GridCreatedSuccess, (payload) => {
            received.push(payload);
        });

        const event = new TestEvent('hello');
        await publisher.publish(event);

        expect(received).toHaveLength(1);
        expect(received[0]).toBe(event);
    });

    it('should deliver event to multiple handlers', async () => {
        bus.clear();
        const first: unknown[] = [];
        const second: unknown[] = [];

        bus.on(EventType.GridCreatedSuccess, (payload) => {
            first.push(payload);
        });
        bus.on(EventType.GridCreatedSuccess, (payload) => {
            second.push(payload);
        });

        await publisher.publish(new TestEvent('multi'));

        expect(first).toHaveLength(1);
        expect(second).toHaveLength(1);
    });

    it('should not deliver event to handlers of different type', async () => {
        bus.clear();
        const received: unknown[] = [];
        bus.on(EventType.OrderOpened, (payload) => {
            received.push(payload);
        });

        await publisher.publish(new TestEvent('wrong-type'));

        expect(received).toHaveLength(0);
    });

    it('should not throw when no handlers are registered', async () => {
        bus.clear();
        await expect(publisher.publish(new TestEvent('no-handlers'))).resolves.not.toThrow();
    });

    it('should preserve event data through publish', async () => {
        bus.clear();
        const received: TestEvent[] = [];
        bus.on(EventType.GridCreatedSuccess, (payload) => {
            received.push(payload as TestEvent);
        });

        const event = new TestEvent('preserve-data');
        await publisher.publish(event);

        expect(received[0].data).toBe('preserve-data');
        expect(received[0].eventType).toBe(EventType.GridCreatedSuccess);
        expect(received[0].timestamp).toBe(event.timestamp);
    });
});
