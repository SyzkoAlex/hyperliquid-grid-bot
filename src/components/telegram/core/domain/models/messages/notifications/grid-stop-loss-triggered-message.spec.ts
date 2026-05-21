import { describe, it, expect } from 'vitest';
import { GridStopLossTriggeredMessage } from './grid-stop-loss-triggered-message';
import { GridStopLossTriggeredEvent } from '@domain/models/events/trading/grid-stop-loss-triggered.event';

describe('GridStopLossTriggeredMessage', () => {
    describe('fromEvent — success path', () => {
        it('contains Stop-Loss Triggered, sold amount, avg price, and USDC received', () => {
            const event = new GridStopLossTriggeredEvent(
                'user-1',
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
            expect(message.text).toContain('Avg Price');
            expect(message.text).not.toContain('Manual action needed');
        });

        it('appends cancel warning when errorMessage is set on success path', () => {
            const event = new GridStopLossTriggeredEvent(
                'user-1',
                'grid-abc',
                'HYPE',
                64,
                44,
                13.65,
                609.84,
                true,
                '4 order(s) could not be cancelled on the exchange — manual review required.',
            );

            const message = GridStopLossTriggeredMessage.fromEvent(event);

            expect(message.text).toContain('All orders cancelled. Grid stopped.');
            expect(message.text).toContain(
                '4 order(s) could not be cancelled on the exchange — manual review required.',
            );
            expect(message.text).not.toContain('Manual action needed');
        });

        it('does not show errorMessage when undefined on success path', () => {
            const event = new GridStopLossTriggeredEvent(
                'user-1',
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

            expect(message.text).toContain('All orders cancelled. Grid stopped.');
            expect(message.text).not.toContain('could not be cancelled');
        });

        it('shows avg price as receivedUSDC / soldBaseAmount', () => {
            const event = new GridStopLossTriggeredEvent(
                'user-1',
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

            // 925 / 0.5 = 1850
            expect(message.text).toContain('1850');
        });
    });

    describe('fromEvent — failure path', () => {
        it('contains Manual action needed and error message', () => {
            const event = new GridStopLossTriggeredEvent(
                'user-1',
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
