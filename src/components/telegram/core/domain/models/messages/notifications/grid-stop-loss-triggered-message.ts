import { GridStopLossTriggeredEvent } from '@domain/models/events/trading/grid-stop-loss-triggered.event';

interface GridStopLossTriggeredProps {
    gridId: string;
    symbol: string;
    stopLossPrice: number;
    triggerPrice: number;
    soldBaseAmount: number;
    receivedUSDC: number;
    success: boolean;
    errorMessage: string | undefined;
}

export class GridStopLossTriggeredMessage {
    readonly text: string;

    private constructor(props: GridStopLossTriggeredProps) {
        if (props.success) {
            this.text =
                `🛑 <b>Stop-Loss Triggered</b>\n\n` +
                `<b>Grid:</b> <code>${props.gridId}</code>\n` +
                `<b>Symbol:</b> ${props.symbol}\n` +
                `<b>SL Price:</b> $${props.stopLossPrice.toLocaleString()}\n\n` +
                `<b>Exit:</b>\n` +
                `• Sold: ${props.soldBaseAmount.toFixed(6)} ${props.symbol}\n` +
                `• Received: ~$${props.receivedUSDC.toFixed(2)} USDC\n\n` +
                `All orders cancelled. Grid stopped.`;
        } else {
            this.text =
                `🛑 <b>Stop-Loss Triggered</b>\n\n` +
                `<b>Grid:</b> <code>${props.gridId}</code>\n` +
                `<b>Symbol:</b> ${props.symbol}\n` +
                `<b>SL Price:</b> $${props.stopLossPrice.toLocaleString()}\n\n` +
                `⚠️ Could not auto-sell within slippage cap.\n` +
                `All orders cancelled. <b>Manual action needed.</b>\n\n` +
                `Reason: ${props.errorMessage ?? 'Unknown'}`;
        }
    }

    static create(props: GridStopLossTriggeredProps): GridStopLossTriggeredMessage {
        return new GridStopLossTriggeredMessage(props);
    }

    static fromEvent(event: GridStopLossTriggeredEvent): GridStopLossTriggeredMessage {
        return GridStopLossTriggeredMessage.create(event);
    }
}
