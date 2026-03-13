export function formatDuration(startedAtMs: number): string {
    const diff = Date.now() - startedAtMs;
    const minutes = Math.floor(diff / 60000) % 60;
    const hours = Math.floor(diff / 3600000) % 24;
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}D ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}
