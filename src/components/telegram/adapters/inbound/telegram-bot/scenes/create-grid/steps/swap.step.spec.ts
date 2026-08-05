import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwapStep } from './swap.step';
import { BotContext } from '../../../types/bot-context';
import { SceneStep } from '../create-grid-scene-step';
import { CreateGridMode } from '../create-grid-mode';
import { SwapSide } from '@components/trading/api/dto/optimal-swap.dto';
import { TradingApiPort } from '@components/trading/api/trading-api.port';
import { BoardRenderer } from '../wizard/board-renderer';

type TradingApiMock = {
    [K in keyof TradingApiPort]: ReturnType<typeof vi.fn>;
};

function createMockTradingApi(overrides: Partial<TradingApiMock> = {}): TradingApiMock {
    return {
        getCurrentPrice: vi.fn(),
        getCurrentPrices: vi.fn(),
        getUserSpotState: vi.fn(),
        pairExists: vi.fn(),
        calculateCapitalDistribution: vi.fn(),
        calculateMaxInvestment: vi.fn(),
        calculateOptimalSwap: vi.fn(),
        executeSpotSwap: overrides.executeSpotSwap ?? vi.fn(),
        probeAgentApproval: vi.fn(),
        getTopSymbolsByVolume: vi.fn(),
        getMinOrderNotional: vi.fn().mockReturnValue(10),
    };
}

type BoardRendererMock = { render: ReturnType<typeof vi.fn> };

function createMockBoardRenderer(): BoardRendererMock {
    return { render: vi.fn().mockResolvedValue(undefined) };
}

const DEFAULT_OFFER = {
    side: SwapSide.UsdcToBase,
    amountUsdc: 200,
    expectedReceived: 6.5,
};
const DEFAULT_PRICE = 40;

function createMockContext(
    overrides: {
        symbol?: string;
        swapOffer?: typeof DEFAULT_OFFER | null;
        swapOfferPrice?: number | null;
        swapFeedback?: string;
        accountAddress?: string;
        detourReturnStep?: SceneStep;
        mode?: CreateGridMode;
    } = {},
): BotContext {
    return {
        session: {
            createGrid: {
                symbol: overrides.symbol ?? 'HYPE',
                swapOffer:
                    overrides.swapOffer === null
                        ? undefined
                        : (overrides.swapOffer ?? DEFAULT_OFFER),
                swapOfferPrice:
                    overrides.swapOfferPrice === null
                        ? undefined
                        : (overrides.swapOfferPrice ?? DEFAULT_PRICE),
                swapFeedback: overrides.swapFeedback,
                totalInvestmentUSDC: 500,
                detourReturnStep: overrides.detourReturnStep,
                mode: overrides.mode,
            },
        },
        user: {
            accountAddress: overrides.accountAddress ?? '0xabc',
        },
        answerCbQuery: vi.fn().mockResolvedValue(undefined),
    } as unknown as BotContext;
}

describe('SwapStep', () => {
    let sut: SwapStep;
    let mockTradingApi: TradingApiMock;
    let mockBoardRenderer: BoardRendererMock;

    beforeEach(() => {
        mockTradingApi = createMockTradingApi();
        mockBoardRenderer = createMockBoardRenderer();
        sut = new SwapStep(
            mockTradingApi as unknown as TradingApiPort,
            mockBoardRenderer as unknown as BoardRenderer,
        );
    });

    describe('buildView', () => {
        it('returns offer body with confirm keyboard when swapOffer is present', async () => {
            const ctx = createMockContext();

            const view = await sut.buildView(ctx);

            expect(view.body).toContain('HYPE');
            expect(view.body).toContain('Swap');
            const hasConfirm = view.keyboard.some((r) =>
                r.some((b) => b.action === 'create_grid:swap_confirm'),
            );
            expect(hasConfirm).toBe(true);
        });

        it('returns error body with a Back + Cancel recovery keyboard when no swapOffer', async () => {
            const ctx = createMockContext({ swapOffer: null });

            const view = await sut.buildView(ctx);

            expect(view.body).toContain('No swap offer found');
            const hasBackAndCancel =
                view.keyboard.length === 1 &&
                view.keyboard[0].some((b) => b.action === 'create_grid:back') &&
                view.keyboard[0].some((b) => b.action === 'create_grid:cancel');
            expect(hasBackAndCancel).toBe(true);
        });

        it('returns error body with a Back + Cancel recovery keyboard when swapOfferPrice is missing', async () => {
            const ctx = createMockContext({ swapOfferPrice: null });

            const view = await sut.buildView(ctx);

            expect(view.body).toContain('No swap offer found');
            const hasBackAndCancel =
                view.keyboard.length === 1 &&
                view.keyboard[0].some((b) => b.action === 'create_grid:back') &&
                view.keyboard[0].some((b) => b.action === 'create_grid:cancel');
            expect(hasBackAndCancel).toBe(true);
            expect(mockTradingApi.getCurrentPrice).not.toHaveBeenCalled();
        });

        it('shows UsdcToBase direction correctly, formatting amounts with the stored swapOfferPrice', async () => {
            const ctx = createMockContext({
                swapOffer: { side: SwapSide.UsdcToBase, amountUsdc: 200, expectedReceived: 6.5 },
                swapOfferPrice: 40,
            });

            const view = await sut.buildView(ctx);

            expect(view.body).toContain('200.00 USDC');
            expect(view.body).toContain('6.500000 HYPE');
            expect(mockTradingApi.getCurrentPrice).not.toHaveBeenCalled();
        });

        it('shows BaseToUsdc direction correctly, converting amountUsdc to a base quantity via swapOfferPrice', async () => {
            const ctx = createMockContext({
                swapOffer: { side: SwapSide.BaseToUsdc, amountUsdc: 50, expectedReceived: 50 },
                swapOfferPrice: 10,
            });

            const view = await sut.buildView(ctx);

            // 50 USDC worth of HYPE at $10/HYPE = 5 HYPE, not 50 HYPE.
            expect(view.body).toContain('5.000000 HYPE');
            expect(view.body).not.toContain('50.000000 HYPE');
            expect(view.body).toContain('50.00 USDC');
            expect(mockTradingApi.getCurrentPrice).not.toHaveBeenCalled();
        });

        it('shows confirm button (not back-only) when offer is present', async () => {
            const ctx = createMockContext();

            const view = await sut.buildView(ctx);

            const hasConfirm = view.keyboard.some((r) =>
                r.some((b) => b.action === 'create_grid:swap_confirm'),
            );
            expect(hasConfirm).toBe(true);
        });

        it('shows Skip button in confirm keyboard', async () => {
            const ctx = createMockContext();

            const view = await sut.buildView(ctx);

            const hasSkip = view.keyboard.some((r) =>
                r.some((b) => b.action === 'create_grid:swap_skip'),
            );
            expect(hasSkip).toBe(true);
        });
    });

    describe('handleConfirm', () => {
        it('renders executing message before swap', async () => {
            mockTradingApi.executeSpotSwap.mockResolvedValue({
                success: true,
                filledBase: 6.5,
                notionalUsdc: 200,
            });
            const ctx = createMockContext();

            await sut.handleConfirm(ctx);

            expect(mockBoardRenderer.render).toHaveBeenCalledOnce();
            const renderedView = mockBoardRenderer.render.mock.calls[0][1];
            expect(renderedView.body).toContain('please wait');
        });

        it('executes swap and returns Investment step on success (advanced mode)', async () => {
            mockTradingApi.executeSpotSwap.mockResolvedValue({
                success: true,
                filledBase: 6.5,
                notionalUsdc: 200,
            });
            const ctx = createMockContext({
                detourReturnStep: SceneStep.Investment,
            });

            const result = await sut.handleConfirm(ctx);

            expect(result).toEqual({ nextStep: SceneStep.Investment });
            expect(mockTradingApi.executeSpotSwap).toHaveBeenCalledWith({
                symbol: 'HYPE',
                side: SwapSide.UsdcToBase,
                amountUsdc: 200,
                accountAddress: '0xabc',
            });
        });

        it('returns Quick step on success when reached from Quick mode', async () => {
            mockTradingApi.executeSpotSwap.mockResolvedValue({
                success: true,
                filledBase: 6.5,
                notionalUsdc: 200,
            });
            const ctx = createMockContext({
                detourReturnStep: SceneStep.Quick,
            });

            const result = await sut.handleConfirm(ctx);

            expect(result).toEqual({ nextStep: SceneStep.Quick });
        });

        it('falls back to Quick when detourReturnStep is missing but mode is Quick (stale pre-migration session)', async () => {
            mockTradingApi.executeSpotSwap.mockResolvedValue({
                success: true,
                filledBase: 6.5,
                notionalUsdc: 200,
            });
            const ctx = createMockContext({ mode: CreateGridMode.Quick });

            const result = await sut.handleConfirm(ctx);

            expect(result).toEqual({ nextStep: SceneStep.Quick });
        });

        it('falls back to Investment when detourReturnStep and mode are both missing (stale pre-migration session)', async () => {
            mockTradingApi.executeSpotSwap.mockResolvedValue({
                success: true,
                filledBase: 6.5,
                notionalUsdc: 200,
            });
            const ctx = createMockContext();

            const result = await sut.handleConfirm(ctx);

            expect(result).toEqual({ nextStep: SceneStep.Investment });
        });

        it('clears swapOffer and totalInvestmentUSDC on success', async () => {
            mockTradingApi.executeSpotSwap.mockResolvedValue({
                success: true,
                filledBase: 6.5,
                notionalUsdc: 200,
            });
            const ctx = createMockContext();

            await sut.handleConfirm(ctx);

            expect(ctx.session.createGrid?.swapOffer).toBeUndefined();
            expect(ctx.session.createGrid?.swapOfferPrice).toBeUndefined();
            expect(ctx.session.createGrid?.totalInvestmentUSDC).toBeUndefined();
        });

        it('sets swapFeedback success message for UsdcToBase on success', async () => {
            mockTradingApi.executeSpotSwap.mockResolvedValue({
                success: true,
                filledBase: 6.5,
                notionalUsdc: 200,
            });
            const ctx = createMockContext({
                swapOffer: { side: SwapSide.UsdcToBase, amountUsdc: 200, expectedReceived: 6.5 },
            });

            await sut.handleConfirm(ctx);

            expect(ctx.session.createGrid?.swapFeedback).toContain('Bought');
            expect(ctx.session.createGrid?.swapFeedback).toContain('HYPE');
        });

        it('sets swapFeedback success message for BaseToUsdc on success', async () => {
            mockTradingApi.executeSpotSwap.mockResolvedValue({
                success: true,
                filledBase: 2.0,
                notionalUsdc: 150,
            });
            const ctx = createMockContext({
                swapOffer: { side: SwapSide.BaseToUsdc, amountUsdc: 50, expectedReceived: 150 },
            });

            await sut.handleConfirm(ctx);

            expect(ctx.session.createGrid?.swapFeedback).toContain('Sold');
        });

        it('sets pendingError (not swapFeedback) and returns null on failure', async () => {
            mockTradingApi.executeSpotSwap.mockResolvedValue({
                success: false,
                filledBase: 0,
                notionalUsdc: 0,
                errorMessage: 'Order rejected',
            });
            const ctx = createMockContext();

            const result = await sut.handleConfirm(ctx);

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toContain('Order rejected');
            expect(ctx.session.createGrid?.swapFeedback).toBeUndefined();
        });

        it('sets pendingError to session expired and returns null when swapOffer is missing', async () => {
            const ctx = createMockContext({ swapOffer: null });

            const result = await sut.handleConfirm(ctx);

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toContain('Session expired');
            expect(ctx.session.createGrid?.swapFeedback).toBeUndefined();
        });

        it('sets pendingError to session expired when accountAddress is missing', async () => {
            const ctx = createMockContext({ accountAddress: '' });
            if (ctx.user) {
                (ctx.user as { accountAddress?: string }).accountAddress = undefined;
            }

            const result = await sut.handleConfirm(ctx);

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toContain('Session expired');
        });

        it('sets pendingError and returns null when executeSpotSwap throws', async () => {
            mockTradingApi.executeSpotSwap.mockRejectedValue(new Error('Network timeout'));
            const ctx = createMockContext();

            const result = await sut.handleConfirm(ctx);

            expect(result).toBeNull();
            expect(ctx.session.createGrid?.pendingError).toContain('Network timeout');
            expect(ctx.session.createGrid?.swapFeedback).toBeUndefined();
        });
    });

    describe('handleSkip', () => {
        it('clears swapOffer and returns Investment step (advanced mode)', async () => {
            const ctx = createMockContext({
                detourReturnStep: SceneStep.Investment,
            });

            const result = await sut.handleSkip(ctx);

            expect(result).toEqual({ nextStep: SceneStep.Investment });
            expect(ctx.session.createGrid?.swapOffer).toBeUndefined();
            expect(ctx.session.createGrid?.swapOfferPrice).toBeUndefined();
        });

        it('returns Quick step when reached from Quick mode', async () => {
            const ctx = createMockContext({
                detourReturnStep: SceneStep.Quick,
            });

            const result = await sut.handleSkip(ctx);

            expect(result).toEqual({ nextStep: SceneStep.Quick });
            expect(ctx.session.createGrid?.swapOffer).toBeUndefined();
            expect(ctx.session.createGrid?.swapOfferPrice).toBeUndefined();
        });

        it('defaults to Investment step when detourReturnStep is unset', async () => {
            const ctx = createMockContext();

            const result = await sut.handleSkip(ctx);

            expect(result).toEqual({ nextStep: SceneStep.Investment });
        });

        it('falls back to Quick when detourReturnStep is missing but mode is Quick (stale pre-migration session)', async () => {
            const ctx = createMockContext({ mode: CreateGridMode.Quick });

            const result = await sut.handleSkip(ctx);

            expect(result).toEqual({ nextStep: SceneStep.Quick });
        });
    });

    describe('rollbackState', () => {
        it('clears swapOffer and swapFeedback from session', () => {
            const ctx = createMockContext({ swapFeedback: 'some feedback' });

            sut.rollbackState(ctx);

            expect(ctx.session.createGrid?.swapOffer).toBeUndefined();
            expect(ctx.session.createGrid?.swapOfferPrice).toBeUndefined();
            expect(ctx.session.createGrid?.swapFeedback).toBeUndefined();
        });
    });
});
