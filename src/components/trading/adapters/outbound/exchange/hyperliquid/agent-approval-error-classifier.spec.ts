import { describe, expect, it } from 'vitest';
import { isAgentNotApprovedError } from './agent-approval-error-classifier';

describe('isAgentNotApprovedError', () => {
    it('returns true for "not approved" message', () => {
        expect(isAgentNotApprovedError(new Error('Agent is not approved'))).toBe(true);
    });

    it('returns true for case-insensitive "NOT APPROVED"', () => {
        expect(isAgentNotApprovedError('Agent NOT APPROVED for address')).toBe(true);
    });

    it('returns true for "user or api wallet ... does not exist"', () => {
        expect(isAgentNotApprovedError('user or api wallet 0xabc does not exist')).toBe(true);
    });

    it('returns false for unrelated error messages', () => {
        expect(isAgentNotApprovedError(new Error('Insufficient balance'))).toBe(false);
    });

    it('returns false for "order not found"', () => {
        expect(isAgentNotApprovedError(new Error('Order not found'))).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(isAgentNotApprovedError('')).toBe(false);
    });

    it('returns false when only one of the wallet-does-not-exist keywords matches', () => {
        expect(isAgentNotApprovedError('user or api wallet foo')).toBe(false);
        expect(isAgentNotApprovedError('address does not exist')).toBe(false);
    });
});
