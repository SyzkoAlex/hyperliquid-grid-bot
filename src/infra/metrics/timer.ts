export function startTimer(): () => number {
    const start = performance.now();
    return () => (performance.now() - start) / 1000;
}
