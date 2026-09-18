import { describe, it, expect } from 'vitest';
import { investmentStepForMode } from './investment-step-for-mode';
import { CreateGridMode } from '../create-grid-mode';
import { SceneStep } from '../create-grid-scene-step';

describe('investmentStepForMode', () => {
    it('maps Quick mode to SceneStep.Quick', () => {
        expect(investmentStepForMode(CreateGridMode.Quick)).toBe(SceneStep.Quick);
    });

    it('maps Ai mode to SceneStep.Ai', () => {
        expect(investmentStepForMode(CreateGridMode.Ai)).toBe(SceneStep.Ai);
    });

    it('maps Advanced mode to SceneStep.Investment', () => {
        expect(investmentStepForMode(CreateGridMode.Advanced)).toBe(SceneStep.Investment);
    });

    it('maps undefined mode to SceneStep.Investment', () => {
        expect(investmentStepForMode(undefined)).toBe(SceneStep.Investment);
    });
});
