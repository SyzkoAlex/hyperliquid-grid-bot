import { BotContext } from '../types/bot-context';
import { UserDto } from '@components/users/api/dto/user.dto';
import { CONNECT_ACCOUNT_SCENE_ID } from '../scenes/connect-account/connect-account.scene';

/**
 * Pre-populates the connectAccount session state from an existing user record
 * (PendingApproval) and enters the connect-account scene. Used by both
 * StartHandler and ConnectAccountHandler to avoid duplicating the same block.
 */
export async function enterConnectAccountScene(ctx: BotContext, user: UserDto): Promise<void> {
    ctx.session.connectAccount = {
        accountAddress: user.accountAddress,
        userId: user.id,
        agentAddress: user.agentAddress,
    };
    await ctx.scene.enter(CONNECT_ACCOUNT_SCENE_ID);
}
