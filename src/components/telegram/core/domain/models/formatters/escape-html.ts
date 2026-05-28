/**
 * Escapes HTML special characters for safe insertion into Telegram HTML messages.
 *
 * @example escapeHtml('<script>') → '&lt;script&gt;'
 */
export function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
