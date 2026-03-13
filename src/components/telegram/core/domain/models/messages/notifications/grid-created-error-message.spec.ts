import { describe, it, expect } from 'vitest';
import { GridCreatedErrorMessage } from './grid-created-error-message';
import { GridCreatedErrorEvent } from '@domain/models/events/trading/grid-created-error.event';

describe('GridCreatedErrorMessage', () => {
    describe('create', () => {
        it('contains the error text', () => {
            const result = GridCreatedErrorMessage.create('Insufficient balance');
            expect(result.text).toContain('Insufficient balance');
        });

        it('contains failure header', () => {
            const result = GridCreatedErrorMessage.create('any error');
            expect(result.text).toContain('Grid Creation Failed');
        });

        it('suggests user action', () => {
            const result = GridCreatedErrorMessage.create('any error');
            expect(result.text).toContain('try again');
        });

        it('handles empty error string', () => {
            const result = GridCreatedErrorMessage.create('');
            expect(result.text).toContain('Grid Creation Failed');
        });
    });

    describe('fromEvent', () => {
        it('extracts error from event', () => {
            const event = new GridCreatedErrorEvent('Exchange rejected order');
            const result = GridCreatedErrorMessage.fromEvent(event);
            expect(result.text).toContain('Exchange rejected order');
        });
    });
});
