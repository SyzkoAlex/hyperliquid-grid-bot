import { Inject, Injectable } from '@nestjs/common';
import { BotContext } from '../../../types/bot-context';
import { InlineButton } from '@components/telegram/core/domain/models/inline-button';
import { CREATE_GRID_ACTIONS } from '../create-grid-actions';
import { WizardStep } from '../wizard/wizard-step';
import { SceneStep } from '../create-grid-scene-step';
import { StepResult } from '../wizard/step-result';
import { StepView } from '../wizard/step-view';
import { TRADING_API_PORT, TradingApiPort } from '@components/trading/api/trading-api.port';
import { SwapSide } from '@components/trading/core/domain/models/swap/swap-side';
import { SpotSwapResultDto } from '@components/trading/api/dto/spot-swap-result.dto';
import { BUTTON_LABELS } from '@components/telegram/core/domain/models/constants/button-labels';
import { SwapMessages } from '@components/telegram/core/domain/models/messages/wizard/swap.messages';
import { BoardRenderer } from '../wizard/board-renderer';
import { logger } from '@/infra/logger/logger';

@Injectable()
export class SwapStep implements WizardStep {
    readonly id = SceneStep.Swap;
    private readonly logger = logger.child({ context: SwapStep.name });

    constructor(
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
        private readonly boardRenderer: BoardRenderer,
    ) {}

    async buildView(ctx: BotContext): Promise<StepView> {
        const session = ctx.session.createGrid;
        const offer = session?.swapOffer;
        const symbol = session?.symbol;

        if (!offer || !symbol) {
            return {
                body: SwapMessages.failed('No swap offer found. Please go back and try again.'),
                keyboard: this.cancelOnlyKeyboard(),
            };
        }

        return {
            body: SwapMessages.offer(symbol, offer),
            keyboard: this.confirmKeyboard(),
        };
    }

    async handleConfirm(ctx: BotContext): Promise<StepResult> {
        const session = ctx.session.createGrid;
        const offer = session?.swapOffer;
        const symbol = session?.symbol;
        const accountAddress = ctx.user?.accountAddress;

        if (!offer || !symbol || !accountAddress) {
            this.logger.warn('Swap confirm called with missing session data');
            if (ctx.session.createGrid) {
                ctx.session.createGrid.pendingError = SwapMessages.sessionExpired();
            }
            return null;
        }

        await this.boardRenderer.render(ctx, {
            body: SwapMessages.executing(),
            keyboard: [],
        });

        let result: SpotSwapResultDto;
        try {
            result = await this.tradingApi.executeSpotSwap({
                symbol,
                side: offer.side,
                amountUsdc: offer.amountUsdc,
                accountAddress,
            });
        } catch (err) {
            this.logger.warn({ err }, 'executeSpotSwap threw an unexpected error');
            if (ctx.session.createGrid) {
                ctx.session.createGrid.pendingError = SwapMessages.failed(
                    err instanceof Error ? err.message : 'Unexpected error',
                );
            }
            return null;
        }

        if (result.success) {
            const feedback =
                offer.side === SwapSide.UsdcToBase
                    ? SwapMessages.successUsdcToBase(symbol, result.filledBase, result.notionalUsdc)
                    : SwapMessages.successBaseToUsdc(
                          symbol,
                          result.filledBase,
                          result.notionalUsdc,
                      );

            if (ctx.session.createGrid) {
                delete ctx.session.createGrid.swapOffer;
                delete ctx.session.createGrid.totalInvestmentUSDC;
                ctx.session.createGrid.swapFeedback = feedback;
            }
            return { nextStep: this.investmentReturnStep(ctx) };
        }

        this.logger.warn({ errorMessage: result.errorMessage }, 'executeSpotSwap returned failure');
        if (ctx.session.createGrid) {
            ctx.session.createGrid.pendingError = SwapMessages.failed(
                result.errorMessage ?? 'Unknown error',
            );
        }
        return null;
    }

    async handleSkip(ctx: BotContext): Promise<StepResult> {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.swapOffer;
        }
        return { nextStep: this.investmentReturnStep(ctx) };
    }

    private investmentReturnStep(ctx: BotContext): SceneStep {
        const history = ctx.session.createGrid?.stepHistory;
        const previousStep = history?.[history.length - 1];
        return previousStep === SceneStep.Quick ? SceneStep.Quick : SceneStep.Investment;
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.swapOffer;
            delete ctx.session.createGrid.swapFeedback;
        }
    }

    private confirmKeyboard(): InlineButton[][] {
        return [
            [{ text: BUTTON_LABELS.CONFIRM, action: CREATE_GRID_ACTIONS.SWAP_CONFIRM }],
            [
                { text: BUTTON_LABELS.SKIP, action: CREATE_GRID_ACTIONS.SWAP_SKIP },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];
    }

    private cancelOnlyKeyboard(): InlineButton[][] {
        return [[{ text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL }]];
    }
}
