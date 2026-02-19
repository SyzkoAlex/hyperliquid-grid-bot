# Grid Bot PnL Calculation Research

## Three Different PnL Metrics — And Why They Get Confused

A grid bot exposes three separate metrics that most platforms bundle together:

---

### 1. Grid Profit (Realized Profit from the Grid)

Pure profit from completed buy→sell cycles. Formula for a spot bot:

```
Grid Profit = Qty_sell × Price_sell × (1 − fee_rate) − Qty_buy × Price_buy × (1 + fee_rate)
```

**Example:** bot bought SOL at $150 and sold at $155, order size 1 SOL, fee 0.1%:
```
Grid Profit = 1 × 155 × 0.999 − 1 × 150 × 1.001
           = 154.845 − 150.15
           = $4.695 per cycle
```

---

### 2. Unrealized PnL

Profit/loss on coins the bot has bought but not yet sold. Grows when the current price is below the average buy price. This is not "your" profit — it is simply a mark-to-market estimate:

```
Unrealized PnL = Qty_held × (Current_price − Avg_buy_price)
```

---

### 3. Total PnL (the only truly accurate metric)

```
Total PnL = Current_equity − Initial_equity ± Deposits/Withdrawals
```

Where `Current_equity = Qty_base × Current_price + Quote_balance`. Everything you hold right now, minus what you put in.

---

## The Trap: Grid Profit ≠ Total PnL

This is where mistakes happen. Suppose the bot reports `Grid Profit = +$200` but `Total PnL = −$50`. How?

While collecting $200 in realized profit from back-and-forth cycles, SOL dropped from $160 to $140. The bot accumulated coins at lower levels, and the unrealized loss on those coins ($250) wiped out the entire grid profit:

```
Total PnL = Grid Profit − Unrealized Loss
          = $200 − $250 = −$50
```

This is the core risk of a spot grid: **you earn on oscillation, but lose on a downtrend.**

---

## PnL Per Grid Level

Useful to calculate upfront to verify the grid is profitable at all:

```
Profit_per_grid = Order_size × (Price_upper − Price_lower) − Fees_both_legs
```

For an arithmetic grid:
```
Grid_step       = (Upper_price − Lower_price) / N_grids
Profit_per_grid = Order_value × (Grid_step / Avg_price) − 2 × Order_value × Fee_rate
```

**Critical breakeven check:** if `Grid_step / Avg_price < 2 × Fee_rate`, every cycle is a net loss.
For Hyperliquid with ~0.025% maker fee, the grid step must be **at least >0.05%** of price.

---

## Comparison vs HODL

The most honest way to evaluate the bot:

```
PnL_bot   = Current_equity − Initial_investment
PnL_hodl  = Initial_qty × Current_price − Initial_investment
Advantage = PnL_bot − PnL_hodl
```

**Bot wins over HODL:** sideways market, price oscillates within range.

**HODL wins:** strong uptrend — the bot sold coins at each level up and now holds little base asset.

**Example:** bot launched on SOL/USDC at $150, invested $10,000. SOL rises to $300.
- HODL: ~66.7 SOL × $300 = $20,000 → profit $10,000
- Bot collected $800 in grid profit but sold SOL along the way; equity ~$15,000 → profit $5,000
- HODL beats the bot by $5,000

---

## Annualized Return (APR/APY)

```
Grid APR  = (Grid_Profit / Total_investment) / Running_days × 365 × 100%
Total APR = (Total_PnL   / Total_investment) / Running_days × 365 × 100%
```

**Always look at Total APR**, not Grid APR. Grid APR shows only one component and always looks better than reality.

---

## Reference Implementation

```typescript
function calculatePnl(state: {
  initialInvestment: number;    // USDC deposited at start
  initialPrice: number;         // SOL price at start
  currentSolBalance: number;    // current SOL balance
  currentUsdcBalance: number;   // current USDC balance
  currentPrice: number;         // current SOL price
  totalFeesPaid: number;        // cumulative fees paid
  realizedGridProfit: number;   // sum of all completed cycles (gross, before fees)
}) {
  const {
    initialInvestment,
    initialPrice,
    currentSolBalance,
    currentUsdcBalance,
    currentPrice,
    totalFeesPaid,
    realizedGridProfit,
  } = state;

  // Current value of all holdings
  const currentEquity = currentSolBalance * currentPrice + currentUsdcBalance;

  // Total PnL — the primary metric
  const totalPnl    = currentEquity - initialInvestment;
  const totalPnlPct = (totalPnl / initialInvestment) * 100;

  // Grid Profit after fees
  const gridProfitNet = realizedGridProfit - totalFeesPaid;

  // Performance vs HODL
  const hodlEquity = initialInvestment * (currentPrice / initialPrice);
  const vsHodl     = currentEquity - hodlEquity;

  return { totalPnl, totalPnlPct, gridProfitNet, vsHodl };
}
```

---

## Key Takeaways

- **Use Total PnL** as the primary metric — it is the only objective measure. Grid Profit without accounting for unrealized losses is misleading.
- **Always calculate vs HODL** — especially for SOL/USDC: if SOL is trending up, the bot may underperform a simple hold. That does not mean the bot is bad — just different strategies for different markets.
- **Verify the fee breakeven** — the grid step must cover the round-trip fee (buy + sell).
- **Show both metrics to users:** Grid Profit (how often and how much the bot earns per cycle) and Total PnL (actual result including price movement). This is honest and prevents inflated "grid profit" expectations.
