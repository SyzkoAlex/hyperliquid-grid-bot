import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/database/database.module';
import { PostgresUserRepositoryAdapter } from './adapters/outbound/persistence/postgres-user-repository.adapter';
import { AgentKeyAdapter } from './adapters/outbound/crypto/agent-key.adapter';
import { UsersApiAdapter } from './api/users-api.adapter';
import { USERS_API_PORT } from './api/users-api.port';
import { USER_REPOSITORY_PORT } from './core/application/ports/user-repository.port';
import { AGENT_KEY_PORT } from './core/application/ports/agent-key.port';

@Module({
    imports: [DatabaseModule],
    providers: [
        { provide: AGENT_KEY_PORT, useClass: AgentKeyAdapter },
        { provide: USER_REPOSITORY_PORT, useClass: PostgresUserRepositoryAdapter },
        { provide: USERS_API_PORT, useClass: UsersApiAdapter },
    ],
    exports: [USERS_API_PORT],
})
export class UsersModule {}
