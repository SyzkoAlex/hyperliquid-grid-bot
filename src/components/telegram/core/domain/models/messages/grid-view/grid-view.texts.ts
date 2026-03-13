import { EMOJI } from '../../constants/emoji';

export class GridViewTexts {
    static readonly NOT_FOUND = `${EMOJI.WARNING} Grid not found.`;
    static readonly LOAD_ERROR = `${EMOJI.ERROR} Failed to load grid data.`;
    static readonly STOPPED_SUCCESS = `${EMOJI.SUCCESS} Grid stopped successfully.`;
    static readonly STOPPED_ERROR = `${EMOJI.ERROR} Failed to stop grid. Please try again.`;
    static readonly STOPPING = `${EMOJI.HOURGLASS} <b>Stopping grid...</b>\n\nCancelling open orders, please wait.`;
}
