import { describe, it, expect } from 'vitest';
import { buildInvestmentPresetKeyboard } from './investment-preset-keyboard';
import { InvestmentPresetKey } from '../create-grid-actions';

const buildAction = (key: InvestmentPresetKey): string => `test:invest:${key}`;

describe('buildInvestmentPresetKeyboard', () => {
    it('renders preset rows with rounded amounts when suggestedMax is set', () => {
        const keyboard = buildInvestmentPresetKeyboard(1000, false, buildAction);

        const flat = keyboard.flat();
        expect(flat.find((b) => b.action === 'test:invest:25')?.text).toBe('25% ($250)');
        expect(flat.find((b) => b.action === 'test:invest:50')?.text).toBe('50% ($500)');
        expect(flat.find((b) => b.action === 'test:invest:75')?.text).toBe('75% ($750)');
        expect(flat.find((b) => b.action === 'test:invest:max')?.text).toBe('Max ($1000)');
    });

    it('omits preset rows when suggestedMax is null', () => {
        const keyboard = buildInvestmentPresetKeyboard(null, false, buildAction);

        const flat = keyboard.flat();
        expect(flat.some((b) => b.action === 'test:invest:25')).toBe(false);
        expect(flat.some((b) => b.action === 'test:invest:max')).toBe(false);
    });

    it('always includes Custom, Back and Cancel rows', () => {
        const keyboard = buildInvestmentPresetKeyboard(null, false, buildAction);

        const flat = keyboard.flat();
        expect(flat.some((b) => b.action === 'test:invest:custom')).toBe(true);
        expect(flat.some((b) => b.action === 'create_grid:back')).toBe(true);
        expect(flat.some((b) => b.action === 'create_grid:cancel')).toBe(true);
    });

    it('renders "Swap to maximize" when both suggestedMax and swap offer are present', () => {
        const keyboard = buildInvestmentPresetKeyboard(1000, true, buildAction);

        const swapButton = keyboard.flat().find((b) => b.action === 'create_grid:swap_offer');
        expect(swapButton?.text).toContain('Swap to maximize');
    });

    it('renders "Swap to fit grid" when swap offer is present without suggestedMax', () => {
        const keyboard = buildInvestmentPresetKeyboard(null, true, buildAction);

        const swapButton = keyboard.flat().find((b) => b.action === 'create_grid:swap_offer');
        expect(swapButton?.text).toContain('Swap to fit grid');
    });

    it('omits the swap row when there is no swap offer', () => {
        const keyboard = buildInvestmentPresetKeyboard(1000, false, buildAction);

        expect(keyboard.flat().some((b) => b.action === 'create_grid:swap_offer')).toBe(false);
    });
});
