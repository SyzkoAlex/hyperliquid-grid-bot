import { describe, expect, it } from 'vitest';
import { ActiveGridsHeaderMessage, StoppedGridsHeaderMessage } from './grids-list.messages';

describe('ActiveGridsHeaderMessage', () => {
    it('shows "No active grids" when count is 0', () => {
        const msg = ActiveGridsHeaderMessage.create(0);
        expect(msg.text).toContain('No active grids running');
    });

    it('shows count without page info for single page', () => {
        const msg = ActiveGridsHeaderMessage.create(5);
        expect(msg.text).toContain('Active Grids</b> (5)');
        expect(msg.text).not.toContain('page');
    });

    it('shows page info when totalPages > 1', () => {
        const msg = ActiveGridsHeaderMessage.create(12, 2, 3);
        expect(msg.text).toContain('(12)');
        expect(msg.text).toContain('page 2/3');
    });
});

describe('StoppedGridsHeaderMessage', () => {
    it('shows "No stopped grids" when totalCount is 0', () => {
        const msg = StoppedGridsHeaderMessage.create(1, 1, 0);
        expect(msg.text).toContain('No stopped grids yet');
    });

    it('shows count without page info for single page', () => {
        const msg = StoppedGridsHeaderMessage.create(1, 1, 3);
        expect(msg.text).toContain('Stopped Grids</b> (3)');
        expect(msg.text).not.toContain('page');
    });

    it('shows page info when totalPages > 1', () => {
        const msg = StoppedGridsHeaderMessage.create(2, 4, 15);
        expect(msg.text).toContain('(15)');
        expect(msg.text).toContain('page 2/4');
    });
});
