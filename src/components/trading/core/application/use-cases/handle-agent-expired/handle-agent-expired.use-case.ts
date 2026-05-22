import { Inject, Injectable } from '@nestjs/common';
import { logger } from '@/infra/logger/logger';
import { UserStatus } from '@domain/models/user/user-status';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';
import {
    EVENT_PUBLISHER_PORT,
    EventPublisherPort,
} from '@/core/application/ports/outbound/event-publisher.port';
import { AgentApprovalLostEvent } from '@domain/models/events/trading/agent-approval-lost.event';
import { AgentExpirationHandlerPort } from '@components/trading/core/application/ports/agent-expiration-handler.port';

@Injectable()
export class HandleAgentExpiredUseCase implements AgentExpirationHandlerPort {
    private readonly logger = logger.child({ context: HandleAgentExpiredUseCase.name });

    constructor(
        @Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort,
        @Inject(EVENT_PUBLISHER_PORT) private readonly publisher: EventPublisherPort,
    ) {}

    async handleAgentExpired(accountAddress: string): Promise<void> {
        const user = await this.usersApi.findUserByAccountAddress(accountAddress);
        if (!user || user.status !== UserStatus.Active) return;

        await this.usersApi.markAgentExpired(user.id);
        await this.publisher.publish(new AgentApprovalLostEvent(user.id));

        this.logger.warn({ userId: user.id }, 'Agent approval lost — user moved to AgentExpired');
    }
}
