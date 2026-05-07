import { describe, it, expect } from 'vitest';
import { GridStopLossTriggeredMessage } from './grid-stop-loss-triggered-message';
import { GridStopLossTriggeredEvent } from '@domain/models/events/trading/grid-stop-loss-triggered.event';

describe('GridStopLossTriggeredMessage', () => {
    describe('fromEvent — success path', () => {
        it('contains Stop-Loss Triggered, sold amount, and USDC received', () => {
            const event = new GridStopLossTriggeredEvent(
                'grid-abc',
                'ETH',
                1900,
                1850,
                0.5,
                925,
                true,
                undefined,
            );

            const message = GridStopLossTriggeredMessage.fromEvent(event);

            expect(message.text).toContain('Stop-Loss Triggered');
            expect(message.text).toContain('grid-abc');
            expect(message.text).toContain('ETH');
            expect(message.text).toContain('0.500000');
            expect(message.text).toContain('925.00');
            expect(message.text).not.toContain('Manual action needed');
        });
    });

    describe('fromEvent — failure path', () => {
        it('contains Manual action needed and error message', () => {
            const event = new GridStopLossTriggeredEvent(
                'grid-xyz',
                'BTC',
                45000,
                44000,
                0,
                0,
                false,
                'IOC sell unfilled after 2 attempts',
            );

            const message = GridStopLossTriggeredMessage.fromEvent(event);

            expect(message.text).toContain('Stop-Loss Triggered');
            expect(message.text).toContain('Manual action needed');
            expect(message.text).toContain('IOC sell unfilled after 2 attempts');
        });
    });
});
