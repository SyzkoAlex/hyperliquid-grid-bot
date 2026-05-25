import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardRenderer } from './board-renderer';
import { BotContext } from '../../../types/bot-context';
import { StepView } from './step-view';
import { SceneStep } from '../create-grid-scene-step';
import { CreateGridMode } from '../create-grid-mode';

function createMockContext(
    overrides: {
        boardChatId?: number;
        boardMessageId?: number;
        createGrid?: Record<string, unknown>;
    } = {},
): BotContext {
    return {
        session: {
            createGrid: overrides.boardChatId
                ? {
                      boardChatId: overrides.boardChatId,
                      boardMessageId: overrides.boardMessageId,
                      ...(overrides.createGrid ?? {}),
                  }
                : overrides.createGrid !== undefined
                  ? overrides.createGrid
                  : {},
        },
        reply: vi.fn().mockResolvedValue({ chat: { id: 100 }, message_id: 200 }),
        telegram: {
            editMessageText: vi.fn().mockResolvedValue(undefined),
        },
    } as unknown as BotContext;
}

const simpleView: StepView = {
    body: 'Select a pair',
    keyboard: [[{ text: 'BTC', action: 'create_grid:pair:BTC' }]],
};

describe('BoardRenderer', () => {
    let sut: BoardRenderer;

    beforeEach(() => {
        sut = new BoardRenderer();
    });

    describe('render — first call (no boardMessageId)', () => {
        it('sends new message and stores ids when boardMessageId is undefined', async () => {
            const ctx = createMockContext();

            await sut.render(ctx, simpleView);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining(simpleView.body),
                expect.objectContaining({ parse_mode: 'HTML' }),
            );
            expect(ctx.session.createGrid?.boardChatId).toBe(100);
            expect(ctx.session.createGrid?.boardMessageId).toBe(200);
        });

        it('does not call editMessageText on first render', async () => {
            const ctx = createMockContext();

            await sut.render(ctx, simpleView);

            expect(ctx.telegram.editMessageText).not.toHaveBeenCalled();
        });
    });

    describe('render — subsequent call (boardMessageId present)', () => {
        it('calls editMessageText with the correct ids and text', async () => {
            const ctx = createMockContext({ boardChatId: 77, boardMessageId: 88 });

            await sut.render(ctx, simpleView);

            expect(ctx.telegram.editMessageText).toHaveBeenCalledWith(
                77,
                88,
                undefined,
                expect.stringContaining(simpleView.body),
                expect.objectContaining({ parse_mode: 'HTML' }),
            );
            expect(ctx.reply).not.toHaveBeenCalled();
        });

        it('passes the keyboard markup on every edit call', async () => {
            const ctx = createMockContext({ boardChatId: 1, boardMessageId: 2 });
            const viewWithKbd: StepView = {
                body: 'Choose mode',
                keyboard: [
                    [{ text: 'Quick', action: 'create_grid:mode:quick' }],
                    [{ text: 'Advanced', action: 'create_grid:mode:advanced' }],
                ],
            };

            await sut.render(ctx, viewWithKbd);

            expect(ctx.telegram.editMessageText).toHaveBeenCalledWith(
                1,
                2,
                undefined,
                expect.stringContaining('Choose mode'),
                expect.objectContaining({ reply_markup: expect.any(Object) }),
            );
        });
    });

    describe('render — fallback on "message to edit not found"', () => {
        it('falls back to sending a new message and updates ids', async () => {
            const ctx = createMockContext({ boardChatId: 9, boardMessageId: 99 });
            vi.mocked(ctx.telegram.editMessageText).mockRejectedValue({
                response: { description: 'Bad Request: message to edit not found' },
            });

            await sut.render(ctx, simpleView);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining(simpleView.body),
                expect.objectContaining({ parse_mode: 'HTML' }),
            );
            expect(ctx.session.createGrid?.boardChatId).toBe(100);
            expect(ctx.session.createGrid?.boardMessageId).toBe(200);
        });

        it('rethrows errors that are not "message to edit not found"', async () => {
            const ctx = createMockContext({ boardChatId: 9, boardMessageId: 99 });
            const unexpectedError = { response: { description: 'Too Many Requests' } };
            vi.mocked(ctx.telegram.editMessageText).mockRejectedValue(unexpectedError);

            await expect(sut.render(ctx, simpleView)).rejects.toEqual(unexpectedError);
        });

        it('returns silently when edit fails with "message is not modified"', async () => {
            const ctx = createMockContext({ boardChatId: 9, boardMessageId: 99 });
            vi.mocked(ctx.telegram.editMessageText).mockRejectedValue({
                response: { description: 'Bad Request: message is not modified' },
            });

            await expect(sut.render(ctx, simpleView)).resolves.not.toThrow();
            expect(ctx.reply).not.toHaveBeenCalled();
        });
    });

    describe('render — pendingError prepend', () => {
        it('prepends pendingError from session before the body', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { pendingError: '❌ Token not found' };
            const view: StepView = { body: 'Select pair', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toContain('❌ Token not found');
            expect(text).toContain('Select pair');
            expect(text).toMatch(/❌ Token not found\n\nSelect pair/);
        });

        it('does not prepend when pendingError is not set', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};
            const view: StepView = { body: 'Select pair', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toContain('Select pair');
            expect(text).not.toContain('undefined');
        });
    });

    describe('stepper — buildStepper', () => {
        it('renders "Step 1" when stepHistory is empty and mode is unknown', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { stepHistory: [] };
            const view: StepView = { body: 'body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toMatch(/^Step 1\n\n/);
        });

        it('renders "Step N of 5" for Quick mode', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                mode: CreateGridMode.Quick,
                stepHistory: [SceneStep.Pair],
            };
            const view: StepView = { body: 'body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toMatch(/^Step 2 of 5\n\n/);
        });

        it('renders "Step N of 9" for Advanced mode', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                mode: CreateGridMode.Advanced,
                stepHistory: [SceneStep.Pair, SceneStep.Mode],
            };
            const view: StepView = { body: 'body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toMatch(/^Step 3 of 9\n\n/);
        });

        it('renders "Step 1" without total when session is empty', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};
            const view: StepView = { body: 'body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toMatch(/^Step 1\n\n/);
        });
    });

    describe('session-based summary rows', () => {
        it('renders Pair row with price from session', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                stepHistory: [SceneStep.Pair],
                symbol: 'HYPE',
                currentPrice: 43.89,
            };
            const view: StepView = { body: 'body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toContain('✓ <b>Pair</b> · HYPE ($43.89)');
        });

        it('renders Pair row without price when currentPrice is not in session', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                stepHistory: [SceneStep.Pair],
                symbol: 'HYPE',
            };
            const view: StepView = { body: 'body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toContain('✓ <b>Pair</b> · HYPE');
            expect(text).not.toContain('($');
        });

        it('renders Mode row as "Quick"', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                stepHistory: [SceneStep.Pair, SceneStep.Mode],
                symbol: 'HYPE',
                mode: CreateGridMode.Quick,
            };
            const view: StepView = { body: 'body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toContain('✓ <b>Mode</b> · Quick');
        });

        it('renders Mode row as "Advanced"', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                stepHistory: [SceneStep.Pair, SceneStep.Mode],
                symbol: 'HYPE',
                mode: CreateGridMode.Advanced,
            };
            const view: StepView = { body: 'body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toContain('✓ <b>Mode</b> · Advanced');
        });

        it('renders Upper and Lower price rows', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                stepHistory: [SceneStep.Pair, SceneStep.Mode, SceneStep.Upper, SceneStep.Lower],
                symbol: 'HYPE',
                mode: CreateGridMode.Advanced,
                upperPrice: 55000,
                lowerPrice: 45000,
            };
            const view: StepView = { body: 'body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toContain('✓ <b>Upper</b> · $55000');
            expect(text).toContain('✓ <b>Lower</b> · $45000');
        });

        it('renders Levels row', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                stepHistory: [SceneStep.Levels],
                levels: 10,
            };
            const view: StepView = { body: 'body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toContain('✓ <b>Levels</b> · 10');
        });

        it('renders Investment row from Quick step', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                stepHistory: [SceneStep.Quick],
                totalInvestmentUSDC: 500,
            };
            const view: StepView = { body: 'body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toContain('✓ <b>Investment</b> · $500 USDC');
        });

        it('renders Investment row from Investment step', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                stepHistory: [SceneStep.Investment],
                totalInvestmentUSDC: 1000,
            };
            const view: StepView = { body: 'body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toContain('✓ <b>Investment</b> · $1000 USDC');
        });

        it('renders Stop Loss row as disabled when stopLossEnabled is false', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                stepHistory: [SceneStep.StopLoss],
                stopLossEnabled: false,
            };
            const view: StepView = { body: 'body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toContain('✓ <b>Stop Loss</b> · Disabled');
        });

        it('renders Stop Loss row with price when stopLossEnabled is true', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                stepHistory: [SceneStep.StopLoss],
                stopLossEnabled: true,
                stopLossPrice: 1980,
            };
            const view: StepView = { body: 'body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toContain('✓ <b>Stop Loss</b> · $1980');
        });

        it('renders no summary rows when stepHistory is empty', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = { stepHistory: [] };
            const view: StepView = { body: 'Just body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).not.toContain('✓');
            expect(text).toContain('Just body');
        });

        it('renders no summary rows when stepHistory is absent', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {};
            const view: StepView = { body: 'Just body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).not.toContain('✓');
        });

        it('does not render rows for steps not in stepHistory', async () => {
            const ctx = createMockContext();
            ctx.session.createGrid = {
                stepHistory: [SceneStep.Pair],
                symbol: 'HYPE',
                mode: CreateGridMode.Advanced,
            };
            const view: StepView = { body: 'body', keyboard: [] };

            await sut.render(ctx, view);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toContain('✓ <b>Pair</b>');
            expect(text).not.toContain('✓ <b>Mode</b>');
        });
    });
});
