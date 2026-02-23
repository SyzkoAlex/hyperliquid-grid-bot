import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/config/config.schema';
import { AppTypes } from '@/config/app.types';
import { EventBusAdapter } from './event-bus.adapter';
import { EventDeserializer } from '@domain/models/events/event-deserializer';
import { ExternalEventBusStub } from './external-event-bus.stub';
import { EVENT_BUS, EventBus } from '@/infra/events/event-bus.port';

@Global()
@Module({
    providers: [
        { provide: EventDeserializer, useValue: new EventDeserializer() },
        {
            provide: EVENT_BUS,
            useFactory: (
                configService: ConfigService<Config, true>,
                eventDeserializer: EventDeserializer,
            ): EventBus => {
                const appType = configService.get('app.type', { infer: true });

                if (appType === AppTypes.ALL_IN_ONE) {
                    return new EventBusAdapter(eventDeserializer);
                }

                return new ExternalEventBusStub();
            },
            inject: [ConfigService, EventDeserializer],
        },
    ],
    exports: [EVENT_BUS],
})
export class EventBusModule {}
