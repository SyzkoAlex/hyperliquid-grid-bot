# Stop-Loss for Spot Grid Bots

## Why grid bots need a stop-loss

A grid bot is a mean-reversion strategy — it does not cut losses on its own, it **accumulates them**. When price drops below the lower bound, the bot holds maximum base inventory with no sells filling. Without a stop-loss, a range break can turn into a structural drawdown.

On spot, a stop-loss is a **discipline tool** (bag-avoidance), not a survival mechanism. "Cancel orders only" is a legitimate policy; "cancel + sell base" is the default for a true stop-loss.

---

## Canonical exit sequence

Order of operations matters — skipping any step is a source of bugs:

1. Mark the grid as stopped (suppress new order placement and refills).
2. Cancel all open orders.
3. Wait for cancellations to confirm — a buy can fill *during* the cancel storm.
4. Re-fetch the actual base balance from the exchange (never trust in-memory state).
5. Market-sell the grid-attributable base (IOC limit, retry with wider cap, abort + notify on failure).
6. Persist terminal state and notify the user.

---

## False-breakout filtering

A single tick below the threshold must not fire the stop. This implementation uses:

- **Time-in-breach** ≥ 30 s (configurable: `stopLoss.confirmDurationMs`)
- **Minimum penetration** ≥ 0.2 % below the stop price (configurable: `stopLoss.penetrationPct`)

Both conditions must hold simultaneously. This approximates a 1 m candle-close confirmation without a candle feed.

---

## Slippage on the exit sell

SL fires when the book is least friendly. Key points:

- The exit sell is the **largest order the bot will ever issue** (maximum accumulated inventory at the worst moment).
- Hyperliquid has no native market orders — use **IOC limit** at `mid × (1 − slippageCap)`.
- Strategy: attempt at 1 % cap → retry at 2 % cap → abort + notify user (configurable via `stopLoss.initialSlippageCapPct` / `stopLoss.retrySlippageCapPct`).

---

## Common mistakes

1. **Stop inside the grid range** — must be strictly below the lower bound with a buffer (≥ 0.5 %).
2. **Triggering on last trade** — use mid-price (mark price), not last trade (wick-prone).
3. **Selling before cancels confirm** — leaves possible filled buys unaccounted for.
4. **Moving the stop down during a drawdown** — "rescue the bot" anti-pattern. Lock or allow tightening only.
5. **Trailing the grid up while leaving the stop static** — stop becomes effectively disabled. Either trail both or neither.
6. **Dust below exchange minimums** — small remainders may fail `minNotional`; handle gracefully.
7. **Auto-restarting after a stop** — a stop means "thesis invalidated". Require explicit user action to restart.
8. **Same stop policy for all assets** — majors tolerate 3–5 %, volatile alts need 8–15 %.
9. **Multiple grids on the same symbol** — the sell amount must be computed per-grid from fills, not the entire account balance.
