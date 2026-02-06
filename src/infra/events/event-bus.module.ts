import { Module, Global } from '@nestjs/common';
import { EventBus } from './event-bus.service';
import { EventDeserializerService } from './event-deserializer.service';

@Global()
@Module({
    providers: [EventBus, EventDeserializerService],
    exports: [EventBus],
})
export class EventBusModule {}
