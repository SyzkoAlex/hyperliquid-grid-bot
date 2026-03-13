import { GridStatus } from '@domain/models/grid/grid-status';
import { EMOJI } from '@components/telegram/core/domain/models/constants/emoji';
import { GridSnapshot } from '@components/telegram/core/domain/models/grid-snapshot';
import { formatDuration } from '@components/telegram/core/domain/models/formatters/format-duration';

const STATUS_EMOJI: Record<GridStatus, string> = {
    [GridStatus.Running]: EMOJI.GREEN_CIRCLE,
    [GridStatus.Stopped]: EMOJI.RED_CIRCLE,
    [GridStatus.Paused]: EMOJI.PAUSE,
    [GridStatus.Idle]: EMOJI.BLUE_CIRCLE,
    [GridStatus.Error]: EMOJI.WARNING,
};

const STATUS_LABEL: Record<GridStatus, string> = {
    [GridStatus.Running]: 'Active',
    [GridStatus.Stopped]: 'Stopped',
    [GridStatus.Paused]: 'Paused',
    [GridStatus.Idle]: 'Idle',
    [GridStatus.Error]: 'Error',
};

export function gridHeaderParts(grid: GridSnapshot['grid']) {
    return {
        pair: `${grid.symbol}/USDC`,
        shortId: grid.id.slice(0, 8),
        emoji: STATUS_EMOJI[grid.status] ?? EMOJI.WARNING,
        label: STATUS_LABEL[grid.status] ?? grid.status,
        duration: grid.startedAt ? ` · ${formatDuration(grid.startedAt)}` : '',
    };
}

export function isGridOutOfRange(
    grid: { lowerPrice: number; upperPrice: number },
    currentPrice: number,
): boolean {
    return currentPrice < grid.lowerPrice || currentPrice > grid.upperPrice;
}
