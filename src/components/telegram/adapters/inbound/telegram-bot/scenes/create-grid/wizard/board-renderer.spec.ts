import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardRenderer } from './board-renderer';
import { BotContext } from '../../../types/bot-context';
import { StepView } from './step-view';

function createMockContext(
    overrides: {
        boardChatId?: number;
        boardMessageId?: number;
    } = {},
): BotContext {
    return {
        session: {
            createGrid: overrides.boardChatId
                ? { boardChatId: overrides.boardChatId, boardMessageId: overrides.boardMessageId }
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
                simpleView.body,
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
                simpleView.body,
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
                'Choose mode',
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
                simpleView.body,
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
            expect(text).toBe('Select pair');
        });
    });

    describe('summary rows rendering', () => {
        it('renders summary rows with checkmark, bold label and value', async () => {
            const ctx = createMockContext();
            const viewWithSummary: StepView = {
                summaryRows: [
                    { label: 'Pair', value: 'BTC/USDC' },
                    { label: 'Mode', value: 'Quick' },
                ],
                body: 'Next step',
                keyboard: [],
            };

            await sut.render(ctx, viewWithSummary);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toContain('✓ <b>Pair</b> · BTC/USDC');
            expect(text).toContain('✓ <b>Mode</b> · Quick');
            expect(text).toContain('\n\nNext step');
        });

        it('renders empty summary when summaryRows is undefined', async () => {
            const ctx = createMockContext();
            const viewWithoutSummary: StepView = {
                body: 'Just body',
                keyboard: [],
            };

            await sut.render(ctx, viewWithoutSummary);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toBe('Just body');
        });

        it('renders empty summary when summaryRows is an empty array', async () => {
            const ctx = createMockContext();
            const viewEmptySummary: StepView = {
                summaryRows: [],
                body: 'Just body',
                keyboard: [],
            };

            await sut.render(ctx, viewEmptySummary);

            const [text] = vi.mocked(ctx.reply).mock.calls[0] as unknown as [string];
            expect(text).toBe('Just body');
        });
    });
});
