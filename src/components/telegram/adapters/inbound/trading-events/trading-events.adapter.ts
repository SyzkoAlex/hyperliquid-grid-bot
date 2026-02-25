import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
    EVENT_SUBSCRIBER_PORT,
    EventSubscriberPort,
} from '@/core/application/ports/inbound/event-subscriber.port';
import { SerializableEvent } from '@domain/models/events/trading/trading-event';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';
import { OrderClosedEvent } from '@domain/models/events/trading/order-closed.event';
import { GridCreatedSuccessEvent } from '@domain/models/events/trading/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';
import { EventDeserializer } from '@domain/models/events/event-deserializer';
import { EventType } from '@domain/models/events/event-type';
import { NotifyUserUseCase } from '@components/telegram/core/application/use-cases/notify-user/notify-user.use-case';
import { logger } from '@/infra/logger/logger';

/**
 * Trading Events Adapter (SPOT Trading)
 *
 * Listens to events from Trading component and sends Telegram notifications.
 */
@Injectable()
export class TradingEventsAdapter implements OnModuleInit {
    private readonly logger = logger.child({ context: TradingEventsAdapter.name });

    constructor(
        @Inject(EVENT_SUBSCRIBER_PORT) private readonly subscriber: EventSubscriberPort,
        private readonly deserializer: EventDeserializer,
        private readonly notifyUser: NotifyUserUseCase,
    ) {}

    onModuleInit() {
        this.subscribeToEvents();
        this.logger.info('Trading events consumer initialized');
    }

    private subscribeToEvents() {
        this.subscriber.subscribe<SerializableEvent>(
            EventType.OrderOpened,
            async (event: SerializableEvent) => {
                const typed = this.deserializer.deserialize(
                    event.eventType,
                    event.serialize(),
                ) as OrderOpenedEvent;
                await this.notifyUser.execute({ event: typed });
            },
        );

        this.subscriber.subscribe<SerializableEvent>(
            EventType.OrderClosed,
            async (event: SerializableEvent) => {
                const typed = this.deserializer.deserialize(
                    event.eventType,
                    event.serialize(),
                ) as OrderClosedEvent;
                await this.notifyUser.execute({ event: typed });
            },
        );

        this.subscriber.subscribe<SerializableEvent>(
            EventType.GridCreatedSuccess,
            async (event: SerializableEvent) => {
                const typed = this.deserializer.deserialize(
                    event.eventType,
                    event.serialize(),
                ) as GridCreatedSuccessEvent;
                await this.notifyUser.execute({ event: typed });
            },
        );

        this.subscriber.subscribe<SerializableEvent>(
            EventType.GridCreatedError,
            async (event: SerializableEvent) => {
                const typed = this.deserializer.deserialize(
                    event.eventType,
                    event.serialize(),
                ) as GridCreatedErrorEvent;
                await this.notifyUser.execute({ event: typed });
            },
        );
    }
}
