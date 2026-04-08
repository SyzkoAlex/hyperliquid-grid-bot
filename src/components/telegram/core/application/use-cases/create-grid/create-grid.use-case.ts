import { Inject, Injectable } from '@nestjs/common';
import { CreateGridCommandEvent } from '@domain/models/events/commands/create-grid-command.event';
import {
    EVENT_PUBLISHER_PORT,
    EventPublisherPort,
} from '@/core/application/ports/outbound/event-publisher.port';
import { CreateGridParams } from './create-grid-params';

@Injectable()
export class CreateGridUseCase {
    constructor(@Inject(EVENT_PUBLISHER_PORT) private readonly publisher: EventPublisherPort) {}

    async execute(params: CreateGridParams): Promise<void> {
        const event = CreateGridCommandEvent.create({
            symbol: params.symbol,
            lowerPrice: params.lowerPrice,
            upperPrice: params.upperPrice,
            levels: params.levels,
            totalInvestmentUSDC: params.totalInvestmentUSDC,
        });

        await this.publisher.publish(event);
    }
}
