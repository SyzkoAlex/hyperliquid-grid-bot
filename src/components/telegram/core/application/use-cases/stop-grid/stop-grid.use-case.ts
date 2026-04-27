import { Inject, Injectable } from '@nestjs/common';
import {
    EVENT_PUBLISHER_PORT,
    EventPublisherPort,
} from '@/core/application/ports/outbound/event-publisher.port';
import { StopGridCommandEvent } from '@domain/models/events/commands/stop-grid-command.event';

@Injectable()
export class StopGridUseCase {
    constructor(@Inject(EVENT_PUBLISHER_PORT) private readonly publisher: EventPublisherPort) {}

    async execute(gridId: string, accountAddress: string): Promise<void> {
        await this.publisher.publish(StopGridCommandEvent.create(gridId, accountAddress));
    }
}
