import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@infra/config/config.schema';
import { AppTypes } from '@infra/config/app.types';
import { EventBusService } from './event-bus.service';
import { EventDeserializerService } from '@domain/events/event-deserializer.service';
import { ExternalEventBusStub } from './external-event-bus.stub';
import { EVENT_BUS, EventBus } from './event-bus.port';

@Global()
@Module({
    providers: [
        EventDeserializerService,
        {
            provide: EVENT_BUS,
            useFactory: (
                configService: ConfigService<Config, true>,
                eventDeserializer: EventDeserializerService,
            ): EventBus => {
                const appType = configService.get('app.type', { infer: true });

                if (appType === AppTypes.ALL_IN_ONE) {
                    return new EventBusService(eventDeserializer);
                }

                return new ExternalEventBusStub();
            },
            inject: [ConfigService, EventDeserializerService],
        },
    ],
    exports: [EVENT_BUS],
})
export class EventBusModule {}
