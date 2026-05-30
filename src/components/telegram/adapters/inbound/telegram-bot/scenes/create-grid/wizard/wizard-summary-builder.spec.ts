import { describe, it, expect } from 'vitest';
import { WizardSummaryBuilder } from './wizard-summary-builder';
import { SceneStep } from '../create-grid-scene-step';
import { CreateGridMode } from '../create-grid-mode';
import { CreateGridWizardState } from '../create-grid-wizard-state';

describe('WizardSummaryBuilder', () => {
    const sut = new WizardSummaryBuilder();

    function state(overrides: Partial<CreateGridWizardState>): CreateGridWizardState {
        return overrides as CreateGridWizardState;
    }

    it('returns empty string when stepHistory is absent', () => {
        expect(sut.buildSummaryFromSession(state({}))).toBe('');
    });

    it('returns empty string when stepHistory is empty', () => {
        expect(sut.buildSummaryFromSession(state({ stepHistory: [] }))).toBe('');
    });

    it('renders Pair row with price', () => {
        const result = sut.buildSummaryFromSession(
            state({ stepHistory: [SceneStep.Pair], symbol: 'HYPE', currentPrice: 43.89 }),
        );
        expect(result).toContain('✓ <b>Pair</b> · HYPE ($43.89)');
    });

    it('renders Pair row without price when currentPrice is absent', () => {
        const result = sut.buildSummaryFromSession(
            state({ stepHistory: [SceneStep.Pair], symbol: 'HYPE' }),
        );
        expect(result).toContain('✓ <b>Pair</b> · HYPE');
        expect(result).not.toContain('($');
    });

    it('renders Mode row as Quick', () => {
        const result = sut.buildSummaryFromSession(
            state({ stepHistory: [SceneStep.Mode], mode: CreateGridMode.Quick }),
        );
        expect(result).toContain('✓ <b>Mode</b> · Quick');
    });

    it('renders Mode row as Advanced', () => {
        const result = sut.buildSummaryFromSession(
            state({ stepHistory: [SceneStep.Mode], mode: CreateGridMode.Advanced }),
        );
        expect(result).toContain('✓ <b>Mode</b> · Advanced');
    });

    it('renders Upper and Lower price rows', () => {
        const result = sut.buildSummaryFromSession(
            state({
                stepHistory: [SceneStep.Upper, SceneStep.Lower],
                upperPrice: 55000,
                lowerPrice: 45000,
            }),
        );
        expect(result).toContain('✓ <b>Upper</b> · $55000');
        expect(result).toContain('✓ <b>Lower</b> · $45000');
    });

    it('renders Levels row', () => {
        const result = sut.buildSummaryFromSession(
            state({ stepHistory: [SceneStep.Levels], levels: 10 }),
        );
        expect(result).toContain('✓ <b>Levels</b> · 10');
    });

    it('renders Investment row from Quick step when grid params absent', () => {
        const result = sut.buildSummaryFromSession(
            state({ stepHistory: [SceneStep.Quick], totalInvestmentUSDC: 500 }),
        );
        expect(result).toContain('✓ <b>Investment</b> · $500 USDC');
        expect(result).not.toContain('<b>Upper</b>');
    });

    it('renders Upper, Lower, Levels and Investment from Quick step when grid params present', () => {
        const result = sut.buildSummaryFromSession(
            state({
                stepHistory: [SceneStep.Quick],
                totalInvestmentUSDC: 2828,
                upperPrice: 52.38,
                lowerPrice: 41.9,
                levels: 20,
            }),
        );
        expect(result).toContain('✓ <b>Upper</b>');
        expect(result).toContain('✓ <b>Lower</b>');
        expect(result).toContain('✓ <b>Levels</b> · 20');
        expect(result).toContain('✓ <b>Investment</b> · $2828 USDC');
        const lines = result.split('\n');
        expect(lines.length).toBe(4);
    });

    it('renders Investment row from Investment step', () => {
        const result = sut.buildSummaryFromSession(
            state({ stepHistory: [SceneStep.Investment], totalInvestmentUSDC: 1000 }),
        );
        expect(result).toContain('✓ <b>Investment</b> · $1000 USDC');
    });

    it('renders Stop Loss row as Disabled when not enabled', () => {
        const result = sut.buildSummaryFromSession(
            state({ stepHistory: [SceneStep.StopLoss], stopLossEnabled: false }),
        );
        expect(result).toContain('✓ <b>Stop Loss</b> · Disabled');
    });

    it('renders Stop Loss row with price when enabled', () => {
        const result = sut.buildSummaryFromSession(
            state({
                stepHistory: [SceneStep.StopLoss],
                stopLossEnabled: true,
                stopLossPrice: 1980,
            }),
        );
        expect(result).toContain('✓ <b>Stop Loss</b> · $1980');
    });

    it('does not render rows for steps not in stepHistory', () => {
        const result = sut.buildSummaryFromSession(
            state({ stepHistory: [SceneStep.Pair], symbol: 'HYPE', mode: CreateGridMode.Advanced }),
        );
        expect(result).toContain('✓ <b>Pair</b>');
        expect(result).not.toContain('✓ <b>Mode</b>');
    });

    it('does not duplicate rows when a step appears twice in history (swap round-trip)', () => {
        // After a swap detour: [Pair, Mode, Quick, Swap, Quick]
        // Quick must appear only once in the summary
        const result = sut.buildSummaryFromSession(
            state({
                stepHistory: [
                    SceneStep.Pair,
                    SceneStep.Mode,
                    SceneStep.Quick,
                    SceneStep.Swap,
                    SceneStep.Quick,
                ],
                symbol: 'HYPE',
                mode: CreateGridMode.Quick,
                totalInvestmentUSDC: 2000,
                upperPrice: 70,
                lowerPrice: 50,
                levels: 10,
            }),
        );
        const lines = result.split('\n');
        const investmentLines = lines.filter((l) => l.includes('<b>Investment</b>'));
        expect(investmentLines).toHaveLength(1);
        const upperLines = lines.filter((l) => l.includes('<b>Upper</b>'));
        expect(upperLines).toHaveLength(1);
    });

    it('joins multiple rows with newlines', () => {
        const result = sut.buildSummaryFromSession(
            state({
                stepHistory: [SceneStep.Pair, SceneStep.Mode],
                symbol: 'HYPE',
                mode: CreateGridMode.Quick,
            }),
        );
        expect(result).toContain('\n');
        expect(result.split('\n').length).toBe(2);
    });
});
