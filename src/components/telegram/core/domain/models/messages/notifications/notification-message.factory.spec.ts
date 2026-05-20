import { describe, expect, it } from 'vitest';
import { NotificationMessageFactory } from './notification-message.factory';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';
import { OrderClosedEvent } from '@domain/models/events/trading/order-closed.event';
import { GridCreatedSuccessEvent } from '@domain/models/events/trading/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';
import { SerializableEvent } from '@domain/models/events/trading/trading-event';
import { EventType } from '@domain/models/events/event-type';

describe('NotificationMessageFactory', () => {
    const factory = new NotificationMessageFactory();

    it('builds TradeOpenedMessage from OrderOpenedEvent', () => {
        const event = new OrderOpenedEvent(
            'user-1',
            'grid-1',
            'BTC',
            'buy',
            95000,
            0.01,
            950,
            1,
            10,
        );
        const msg = factory.buildFromEvent(event);
        expect(msg.text).toContain('BUY BTC');
    });

    it('builds TradeClosedMessage from OrderClosedEvent', () => {
        const event = new OrderClosedEvent(
            'user-1',
            'grid-1',
            'BTC',
            'sell',
            96000,
            0.01,
            960,
            10,
            1,
            10,
        );
        const msg = factory.buildFromEvent(event);
        expect(msg.text).toContain('SELL BTC');
        expect(msg.text).toContain('Profit:');
    });

    it('builds GridCreatedSuccessMessage from GridCreatedSuccessEvent', () => {
        const event = new GridCreatedSuccessEvent(
            'user-1',
            'grid-1',
            'ETH',
            3000,
            4000,
            10,
            500,
            0.15,
            false,
        );
        const msg = factory.buildFromEvent(event);
        expect(msg.text).toContain('Grid Created');
    });

    it('builds GridCreatedErrorMessage from GridCreatedErrorEvent', () => {
        const event = new GridCreatedErrorEvent('user-1', 'Insufficient balance');
        const msg = factory.buildFromEvent(event);
        expect(msg.text).toContain('Grid Creation Failed');
        expect(msg.text).toContain('Insufficient balance');
    });

    it('throws for unsupported event type', () => {
        class UnknownEvent extends SerializableEvent {
            constructor() {
                super('unknown' as EventType, 'user-1');
            }

            protected toJSON(): Record<string, unknown> {
                return {};
            }
        }

        expect(() => factory.buildFromEvent(new UnknownEvent())).toThrow('Unknown event type');
    });
});
