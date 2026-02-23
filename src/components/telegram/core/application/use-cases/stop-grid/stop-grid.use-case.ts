import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, EventBus } from '@/infra/events/event-bus.port';
import { StopGridCommandEvent } from '@domain/models/events/commands/stop-grid-command.event';

@Injectable()
export class StopGridUseCase {
    constructor(@Inject(EVENT_BUS) private readonly eventBus: EventBus) {}

    async execute(gridId: string): Promise<void> {
        await this.eventBus.publish(StopGridCommandEvent.create(gridId));
    }
}
