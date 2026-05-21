import { SerializableEvent } from './trading-event';
import { EventType } from '../event-type';

export class AgentApprovalLostEvent extends SerializableEvent {
    constructor(userId: string, timestamp?: number) {
        super(EventType.AgentApprovalLost, userId, timestamp);
    }

    protected toJSON(): Record<string, unknown> {
        return {};
    }

    static deserialize(json: string): AgentApprovalLostEvent {
        const data = JSON.parse(json);
        return new AgentApprovalLostEvent(data.userId, data.timestamp);
    }
}
