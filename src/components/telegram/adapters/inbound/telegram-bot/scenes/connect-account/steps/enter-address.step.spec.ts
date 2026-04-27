import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnterAddressStep } from './enter-address.step';
import { BotContext } from '../../../types/bot-context';
import { ConnectAccountSceneStep } from '../connect-account-scene-step';

function makeCtx(text?: string): BotContext {
    return {
        reply: vi.fn().mockResolvedValue(undefined),
        session: { connectAccount: {} },
        scene: { leave: vi.fn().mockResolvedValue(undefined) },
        message: text !== undefined ? { text } : undefined,
    } as unknown as BotContext;
}

describe('EnterAddressStep', () => {
    let sut: EnterAddressStep;

    beforeEach(() => {
        sut = new EnterAddressStep();
    });

    describe('enter', () => {
        it('should set the current step and send prompt message', async () => {
            const ctx = makeCtx();

            await sut.enter(ctx);

            expect(ctx.session.connectAccount!.currentStep).toBe(
                ConnectAccountSceneStep.EnterAddress,
            );
            expect(ctx.reply).toHaveBeenCalledOnce();
        });
    });

    describe('handleTextInput', () => {
        it('should return false and reply error for an invalid Ethereum address', async () => {
            const ctx = makeCtx();

            const result = await sut.handleTextInput(ctx, 'not-an-address');

            expect(result).toBe(false);
            expect(ctx.reply).toHaveBeenCalledOnce();
        });

        it('should return false for an address without 0x prefix', async () => {
            const ctx = makeCtx();
            const result = await sut.handleTextInput(
                ctx,
                '1234567890123456789012345678901234567890',
            );
            expect(result).toBe(false);
        });

        it('should return false for an address with wrong length', async () => {
            const ctx = makeCtx();
            const result = await sut.handleTextInput(ctx, '0x123');
            expect(result).toBe(false);
        });

        it('should return true and save address to session state for a valid address', async () => {
            const ctx = makeCtx();
            const validAddress = '0x1234567890123456789012345678901234567890';

            const result = await sut.handleTextInput(ctx, validAddress);

            expect(result).toBe(true);
            expect(ctx.session.connectAccount!.accountAddress).toBe(validAddress);
            expect(ctx.reply).not.toHaveBeenCalled();
        });

        it('should accept uppercase hex characters in address', async () => {
            const ctx = makeCtx();
            const validAddress = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';

            const result = await sut.handleTextInput(ctx, validAddress);

            expect(result).toBe(true);
        });
    });
});
