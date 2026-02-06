import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBus } from '@infra/events/event-bus.service';
import { OrderOpenedEvent } from '@domain/events/trading/order-opened.event';
import { OrderClosedEvent } from '@domain/events/trading/order-closed.event';
import { GridCreatedSuccessEvent } from '@domain/events/trading/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/events/trading/grid-created-error.event';
import { EventType } from '@domain/events/event-type';
import { NotifyUserUseCase } from '../../core/use-cases/notify-user/notify-user.use-case';
import { logger } from '@infra/logger/logger';

/**
 * Trading Events Controller (SPOT Trading)
 *
 * Listens to events from Trading component and sends Telegram notifications.
 */
@Injectable()
export class TradingEventsController implements OnModuleInit {
    private readonly logger = logger.child({ context: TradingEventsController.name });

    constructor(
        private readonly eventBus: EventBus,
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
