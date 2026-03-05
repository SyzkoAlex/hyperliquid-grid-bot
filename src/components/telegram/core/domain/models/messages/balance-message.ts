import { TelegramMessage } from './telegram-message';
import { EMOJI } from '../constants/emoji';
import { UserBalance } from '../user-balance';
import { formatFiat } from '../formatters/format-fiat';

export class BalanceMessage extends TelegramMessage {
    protected readonly text: string;

    constructor(balance: UserBalance) {
        super();
        const lines: string[] = [];

        lines.push(`<b>${EMOJI.MONEY_BAG} Balance</b>`);
        lines.push('');

        lines.push(`<b>USDC:</b> ${formatFiat(balance.usdc.total)}`);
        if (balance.usdc.inOrders > 0) {
            lines.push(
                `  Available: ${formatFiat(balance.usdc.available)} · In Orders: ${formatFiat(balance.usdc.inOrders)}`,
            );
        }

        if (balance.tokens.length > 0) {
            lines.push('');
            lines.push(`<b>${EMOJI.CHART} Positions:</b>`);
            for (const token of balance.tokens) {
                lines.push(
                    `▸ <b>${token.symbol}:</b> ${fmtQty(token.total)} ($${formatFiat(token.valueUsdc)})`,
                );
                if (token.inOrders > 0) {
                    lines.push(
                        `  Available: ${fmtQty(token.available)} · In Orders: ${fmtQty(token.inOrders)}`,
                    );
                }
            }
        }

        lines.push('');
        lines.push(`<b>Portfolio:</b> $${formatFiat(balance.totalValueUsdc)}`);

        this.text = lines.join('\n');
    }
}

function fmtQty(value: number): string {
    if (value === 0) return '0';
    if (value >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
    return value.toLocaleString('en-US', { maximumFractionDigits: 8 });
}
