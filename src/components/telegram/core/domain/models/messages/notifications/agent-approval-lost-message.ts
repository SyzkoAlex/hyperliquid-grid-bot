import { AgentApprovalLostEvent } from '@domain/models/events/trading/agent-approval-lost.event';
import { TelegramMessage } from '../telegram-message';

export class AgentApprovalLostMessage implements TelegramMessage {
    readonly text =
        '⚠️ <b>Agent Wallet Approval Lost</b>\n\n' +
        'Your Hyperliquid agent wallet approval has expired or been revoked.\n\n' +
        'The bot cannot place or cancel orders for you until you re-approve.\n\n' +
        'Tap the button below to reconnect your account.';

    readonly buttonText = '🔗 Reconnect account';

    static create(): AgentApprovalLostMessage {
        return new AgentApprovalLostMessage();
    }

    static fromEvent(_event: AgentApprovalLostEvent): AgentApprovalLostMessage {
        return AgentApprovalLostMessage.create();
    }
}
