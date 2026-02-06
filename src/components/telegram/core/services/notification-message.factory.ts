import { Injectable } from '@nestjs/common';
import { SerializableEvent } from '@domain/events/trading/trading-event';
import { OrderOpenedEvent } from '@domain/events/trading/order-opened.event';
import { OrderClosedEvent } from '@domain/events/trading/order-closed.event';
import { GridCreatedSuccessEvent } from '@domain/events/trading/grid-created-success.event';
import { GridCreatedErrorEvent } from '@domain/events/trading/grid-created-error.event';
import { TelegramMessage } from '../domain/messages/telegram-message';
import { GridCreatedSuccessMessage } from '../domain/messages/grid-created-success-message';
import { GridCreatedErrorMessage } from '../domain/messages/grid-created-error-message';
import { TradeOpenedMessage } from '../domain/messages/trade-opened-message';
import { TradeClosedMessage } from '../domain/messages/trade-closed-message';

@Injectable()
export class NotificationMessageFactory {
    buildFromEvent(event: SerializableEvent): TelegramMessage {
        if (event instanceof OrderOpenedEvent) {
            return new TradeOpenedMessage({
                symbol: event.symbol,
                side: event.side,
                price: event.price,
                amount: event.amount,
                total: event.total,
                level: event.level,
                totalLevels: event.totalLevels,
            });
        }

        if (event instanceof OrderClosedEvent) {
            return new TradeClosedMessage({
                symbol: event.symbol,
                side: event.side,
                price: event.price,
                amount: event.amount,
                total: event.total,
                profit: event.profit,
                profitPercent: ((event.profit / event.total) * 100).toFixed(2),
                level: event.level,
                totalLevels: event.totalLevels,
            });
        }

        if (event instanceof GridCreatedSuccessEvent) {
            return new GridCreatedSuccessMessage({
                gridId: event.gridId,
                symbol: event.symbol,
                mode: event.mode,
                lowerPrice: event.lowerPrice,
                upperPrice: event.upperPrice,
                levels: event.levels,
                investmentUSDC: event.investmentUSDC,
                investmentBase: event.investmentBase,
                trailingEnabled: event.trailingEnabled,
            });
        }

        return new GridCreatedErrorMessage((event as GridCreatedErrorEvent).error);
    }
}
