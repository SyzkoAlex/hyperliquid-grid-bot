import { EMOJI } from './emoji.constants';

export const BUTTON_LABELS = {
    BACK: `${EMOJI.BACK} Back`,
    CANCEL: `${EMOJI.CANCEL} Cancel`,
    CONFIRM: `${EMOJI.SUCCESS} Confirm`,
    OTHER_TOKEN: `${EMOJI.SEARCH} Other token`,
    MODE_QUICK: `${EMOJI.LIGHTNING} Quick start`,
    MODE_ADVANCED: `${EMOJI.SETTINGS} Advanced`,
} as const;
