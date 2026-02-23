import { Global, Module } from '@nestjs/common';
import { EventBusAdapter } from './event-bus.adapter';
import { EventDeserializer } from '@domain/models/events/event-deserializer';
import { EVENT_BUS } from '@/infra/events/event-bus.port';

@Global()
@Module({
    providers: [
        { provide: EventDeserializer, useValue: new EventDeserializer() },
        { provide: EVENT_BUS, useClass: EventBusAdapter },
    ],
    exports: [EVENT_BUS],
})
export class EventBusModule {}
