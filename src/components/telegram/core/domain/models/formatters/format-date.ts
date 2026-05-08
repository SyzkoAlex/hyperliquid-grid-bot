const DEFAULT_TIMEZONE = 'UTC';

export function formatDate(ts: number, timezone: string = DEFAULT_TIMEZONE): string {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
    });
    return formatter.format(new Date(ts)).replace(',', '');
}
