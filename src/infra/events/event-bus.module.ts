import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@infra/config/config.schema';
import { AppTypes } from '@infra/config/app.types';
import { EventBusService } from './event-bus.service';
import { EventDeserializer } from '@domain/models/events/event-deserializer';
import { ExternalEventBusStub } from './external-event-bus.stub';
import { EVENT_BUS, EventBus } from './event-bus.port';

@Global()
@Module({
    providers: [
        EventDeserializer,
        {
            provide: EVENT_BUS,
            useFactory: (
                configService: ConfigService<Config, true>,
                eventDeserializer: EventDeserializer,
            ): EventBus => {
                const appType = configService.get('app.type', { infer: true });

                if (appType === AppTypes.ALL_IN_ONE) {
                    return new EventBusService(eventDeserializer);
                }

                return new ExternalEventBusStub();
            },
            inject: [ConfigService, EventDeserializer],
        },
    ],
    exports: [EVENT_BUS],
})
export class EventBusModule {}
