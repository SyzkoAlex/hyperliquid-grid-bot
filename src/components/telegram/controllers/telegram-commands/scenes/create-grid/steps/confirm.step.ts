import { WizardContext } from '../../../../../core/domain/wizard-context';
import { CreateGridCommandEvent } from '@domain/events/commands/create-grid-command.event';
import { EventBus } from '@infra/events/event-bus.port';
import { CreateGridWizardState } from '../../../../../core/domain/create-grid-wizard-state';

export class ConfirmStep {
    constructor(private readonly eventBus: EventBus) {}

    async execute(ctx: WizardContext): Promise<void> {
        const session = ctx.getSession();
        const state = session.createGrid;

        if (!this.validateState(state)) {
            await ctx.reply('❌ Invalid grid configuration. Please start over.');
            await ctx.leaveScene();
            return;
        }

        try {
            const event = CreateGridCommandEvent.create({
                symbol: state!.symbol!,
                upperPrice: state!.upperPrice!,
                lowerPrice: state!.lowerPrice!,
                levels: state!.levels!,
                totalInvestmentUSDC: state!.totalInvestmentUSDC,
                mode: state!.mode || 'neutral',
            });

            await this.eventBus.publish(event);

            await ctx.reply(
                `✅ <b>Grid creation started!</b>\n\n` +
                    `Symbol: ${state!.symbol}\n` +
                    `Price Range: ${state!.lowerPrice?.toFixed(4)} - ${state!.upperPrice?.toFixed(4)}\n` +
                    `Levels: ${state!.levels}\n` +
                    `Investment: ${state!.totalInvestmentUSDC} USDC\n\n` +
                    `You'll receive notifications when orders are placed.`,
                undefined,
                'HTML',
            );

            delete session.createGrid;
            await ctx.leaveScene();
        } catch (error) {
            await ctx.reply(`❌ Failed to create grid. Please try again later.`);
            await ctx.leaveScene();
        }
    }

    private validateState(state: CreateGridWizardState | undefined): boolean {
        return !!(
            state?.symbol &&
            state?.upperPrice &&
            state?.lowerPrice &&
            state?.levels &&
            state?.totalInvestmentUSDC
        );
    }
}
