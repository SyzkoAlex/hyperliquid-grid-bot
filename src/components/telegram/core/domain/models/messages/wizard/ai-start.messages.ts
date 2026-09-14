import { EMOJI } from '../../constants/emoji';
import { WIZARD_CONFIG } from '../../constants/wizard-config';
import { Decimal } from '@domain/models/primitives/decimal';
import { PriceFormatter } from '../../formatters/price.formatter';
import { PredictionWarning } from '@components/prediction/api/dto/prediction-warning';
import { feeHintLine } from './fee-hint';
import { predictionWarningLines } from './prediction-warning-labels';

interface AiSuggestionBlockParams {
    symbol: string;
    lowerPrice: number;
    upperPrice: number;
    orderCount: number;
    conservativePnlUsdc: number | null;
    periodDays?: number;
    warnings: PredictionWarning[];
}

interface AiBalanceParams {
    symbol: string;
    usdcBalance: Decimal;
    baseBalance: Decimal;
    baseInUsdc: Decimal;
    totalBalance: Decimal;
    currentPrice: number;
    suggestedMax: number;
    lowerPrice: number;
    upperPrice: number;
    orderCount: number;
}

export class AiStartMessages {
    /** Board body shown while /suggest is being fetched. */
    static loading(symbol: string): string {
        return (
            `${EMOJI.ROBOT} <b>AI mode</b>\n\n` +
            `${EMOJI.HOURGLASS} Analyzing <b>${symbol}</b> market data…\n` +
            `This can take up to a minute.`
        );
    }

    /** AI block prepended to the investment prompt when the service returned a suggestion. */
    static suggestionBlock(params: AiSuggestionBlockParams): string {
        const { symbol, lowerPrice, upperPrice, orderCount, conservativePnlUsdc, periodDays } =
            params;
        const lines = [
            `${EMOJI.ROBOT} <b>AI suggestion</b> for ${symbol}`,
            `${EMOJI.CHART} Range: $${PriceFormatter.format(lowerPrice)} – $${PriceFormatter.format(upperPrice)} · ${orderCount} orders`,
        ];
        if (conservativePnlUsdc !== null) {
            const sign = conservativePnlUsdc >= 0 ? '+' : '-';
            const amount = Math.abs(conservativePnlUsdc).toFixed(2);
            const period = periodDays !== undefined ? ` per ${periodDays} days` : '';
            lines.push(
                `${EMOJI.CHART_UP} Backtest: ${sign}$${amount}${period} ` +
                    `(at a $1,000 test budget — past result, not a forecast)`,
            );
        }
        lines.push(...predictionWarningLines(params.warnings));
        return lines.join('\n');
    }

    /** Notice prepended when the service failed or declined — quick defaults applied. */
    static fallbackNotice(): string {
        return (
            `${EMOJI.WARNING} AI suggestion is unavailable right now — ` +
            `using the default ±${WIZARD_CONFIG.PRICE_RANGE_PERCENT}% range with ${WIZARD_CONFIG.DEFAULT_ORDERS} orders.`
        );
    }

    /** Full investment prompt: AI/fallback header block + balance section (mirrors QuickStartPromptMessage). */
    static prompt(header: string, balance?: AiBalanceParams): string {
        if (!balance) {
            return `${header}\n\n` + `How much to invest?\n\n` + feeHintLine();
        }

        const { symbol, usdcBalance, baseBalance, totalBalance, suggestedMax, orderCount } =
            balance;

        const feeHint = feeHintLine({
            totalInvestment: suggestedMax,
            orderCount,
            lowerPrice: balance.lowerPrice,
            upperPrice: balance.upperPrice,
        });

        const totalRounded = Math.round(totalBalance.toNumber()).toLocaleString('en-US');
        const usdcRounded = Math.round(usdcBalance.toNumber()).toLocaleString('en-US');
        const baseFormatted = parseFloat(baseBalance.toNumber().toFixed(2)).toLocaleString('en-US');

        return (
            `${header}\n\n` +
            `How much to invest?\n\n` +
            `${EMOJI.MONEY} Available: ~${totalRounded} USDC\n` +
            `   (${usdcRounded} USDC + ${baseFormatted} ${symbol})\n\n` +
            `${EMOJI.BULB} Recommended: ~${suggestedMax} USDC for ${orderCount} orders\n` +
            feeHint
        );
    }
}
