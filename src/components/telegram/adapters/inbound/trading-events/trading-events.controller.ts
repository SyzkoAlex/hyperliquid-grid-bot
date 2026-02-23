import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBus } from '@/infra/events/event-bus.port';
import { OrderOpenedEvent } from '@domain/models/events/trading/order-opened.event';
import { OrderClosedEvent } from '@domain/models/events/trading/order-closed.event';
import { GridCreatedSuccessEvent } from '@domain/models/events/trading/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';
import { EventType } from '@domain/models/events/event-type';
import { NotifyUserUseCase } from '@components/telegram/core/application/use-cases/notify-user/notify-user.use-case';
import { logger } from '@/infra/logger/logger';

/**
 * Trading Events Controller (SPOT Trading)
 *
 * Listens to events from Trading component and sends Telegram notifications.
 */
@Injectable()
export class TradingEventsController implements OnModuleInit {
    private readonly logger = logger.child({ context: TradingEventsController.name });

    constructor(
        @Inject(EVENT_BUS) private readonly eventBus: EventBus,
        private readonly notifyUser: NotifyUserUseCase,
    ) {}

    onModuleInit() {
        this.subscribeToEvents();
        this.logger.info('Trading events consumer initialized');
    }

    private subscribeToEvents() {
        this.eventBus.subscribe(EventType.OrderOpened, async (event: OrderOpenedEvent) => {
            await this.notifyUser.execute({ event });
        });

        this.eventBus.subscribe(EventType.OrderClosed, async (event: OrderClosedEvent) => {
            await this.notifyUser.execute({ event });
        });

        this.eventBus.subscribe(
            EventType.GridCreatedSuccess,
            async (event: GridCreatedSuccessEvent) => {
                await this.notifyUser.execute({ event });
            },
        );

        this.eventBus.subscribe(
            EventType.GridCreatedError,
            async (event: GridCreatedErrorEvent) => {
                await this.notifyUser.execute({ event });
            },
        );
    }
}
