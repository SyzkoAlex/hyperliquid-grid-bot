import { Inject, Injectable } from '@nestjs/common';
import { CreateGridCommandEvent } from '@domain/models/events/commands/create-grid-command.event';
import { EVENT_BUS, EventBus } from '@infra/events/event-bus.port';
import { CreateGridParams } from './create-grid-params';

@Injectable()
export class CreateGridUseCase {
    constructor(@Inject(EVENT_BUS) private readonly eventBus: EventBus) {}

    async execute(params: CreateGridParams): Promise<void> {
        const event = CreateGridCommandEvent.create({
            symbol: params.symbol,
            mode: params.mode,
            lowerPrice: params.lowerPrice,
            upperPrice: params.upperPrice,
            levels: params.levels,
            totalInvestmentUSDC: params.totalInvestmentUSDC,
        });

        await this.eventBus.publish(event);
    }
}
