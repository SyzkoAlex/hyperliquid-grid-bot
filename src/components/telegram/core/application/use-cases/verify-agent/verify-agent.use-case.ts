import { Inject, Injectable } from '@nestjs/common';
import { USERS_API_PORT, UsersApiPort } from '@components/users/api/users-api.port';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { logger } from '@/infra/logger/logger';

/**
 * Verifies that the agent wallet has been approved by the user on Hyperliquid.
 *
 * Performs a signed no-op cancel with the agent key. If the agent is not yet
 * approved on-chain, Hyperliquid returns a distinct "not approved" error. Any
 * other error (e.g. "order not found") means the agent IS approved.
 */
@Injectable()
export class VerifyAgentUseCase {
    private readonly logger = logger.child({ context: VerifyAgentUseCase.name });

    constructor(
        @Inject(USERS_API_PORT) private readonly usersApi: UsersApiPort,
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
    ) {}

    async execute(userId: string): Promise<{ success: boolean }> {
        const user = await this.usersApi.findUserById(userId);
        if (!user) {
            this.logger.warn({ userId }, 'User not found during agent verification');
            return { success: false };
        }

        const probeResult = await this.tradingApi.probeAgentApproval(user.accountAddress);
        if (!probeResult.approved) {
            this.logger.info({ userId }, 'Agent not yet approved');
            return { success: false };
        }

        await this.usersApi.activateUser(userId);
        this.tradingApi.notifyAgentActivated(user.accountAddress);
        this.logger.info(
            { userId, accountAddress: user.accountAddress },
            'User agent verified and activated',
        );
        return { success: true };
    }
}
