# TODO

## High Priority

### Cancel Orphaned Exchange Orders

When a grid is stopped, some orders may not get cancelled on the exchange (network error, partial failure). These orphaned orders remain active and can cause "Insufficient spot balance" errors for other grids.

In `OrderRestoreService.restoreOrders()`, after restoring pending orders:

- [ ] For each exchange order with a valid cloid, resolve the associated grid
- [ ] If grid is stopped/not found — cancel the order on the exchange
- [ ] Log cancelled orphaned orders with grid/order details

### Token Swap

Swap tokens directly in the Telegram bot (e.g. USDC → BTC). Useful when user has USDC but needs base token for grid creation.

- [ ] Research Hyperliquid spot swap/trade API
- [ ] `SwapScene` wizard: select pair → enter amount → show price & estimated amount → confirm → execute
- [ ] `SwapUseCase` — Hyperliquid spot market order
- [ ] Button in main menu or from `/balance`
- [ ] Auto-swap before grid creation: if only USDC → swap 50% to base token (optional, config flag)

### Surface Create Grid Errors in Telegram

- [ ] Surface balance validation errors from `CreateAndStartGridUseCase` to user in create-grid scene (currently throws but Telegram doesn't show the specific error)

---

## Medium Priority

### GridPnlCalculatorService Improvements

Core `gridProfit` + `unrealizedPnl` are implemented. Remaining:

- [ ] Track cumulative fees per grid, subtract from realized profit → `gridProfitNet`
- [ ] Add `vsHodl = currentEquity − hodlEquity` comparison
- [ ] Add breakeven check: warn if `gridStep / avgPrice < 2 × feeRate`

### Grid Gap Scan

**Problem:** the system is purely event-driven (`fill → refill`). If an order is cancelled, fails,
or a WS event is lost, the gap in the grid persists indefinitely. Example: grid `de8a2d64`,
level 1 sell (83.3454) was cancelled by the exchange — bot placed nothing in its place.

**Solution:** a new `GridGapScanUseCase` running periodically (~5 min) as a safety net.

Gap detection logic per running grid:
- Load all `filled` (history) and `placed`/`pending` (active) orders
- For each level N: if there is a `filled buy` at N without a `placed sell` at N+1 → gap
- For each level N: if there is a `filled sell` at N without a `placed buy` at N-1 → gap
- Before placing a missing order, check current price — skip if sell would be below bid or buy above ask

Implementation structure:
```
trading/adapters/inbound/grid-gap-scan/
  grid-gap-scan.adapter.ts          # periodic trigger (OnModuleInit + setInterval)
trading/core/application/
  use-cases/scan-grid-gaps/
    scan-grid-gaps.use-case.ts      # orchestrator: iterates grids, calls detector + refill
  services/grid-gap-detector/
    grid-gap-detector.service.ts    # pure logic: filled + placed orders → list of RefillParams
```

Required changes:
- [ ] `OrderRepositoryPort.findFilledOrdersByGridId(gridId)` — add (currently only `findActiveOrders` exists)
- [ ] `GridsApiPort` — expose filled orders method
- [ ] `GridGapDetectorService` — pure, no I/O, returns `RefillParams[]`
- [ ] `ScanGridGapsUseCase` — calls detector, then `OrderRefillService.processOne()` per gap
- [ ] `GridGapScanAdapter` — periodic trigger, concurrency guard, interval from config
- [ ] Config: `orders.gapScanIntervalMs: 300000`

### Risk Management

- [ ] Order placement retry logic (3 attempts with backoff)
- [ ] WebSocket reconnection logic
- [ ] Rate limiting for exchange API

### Remove Hyperliquid SDK Dependency

Replace `hyperliquid` npm package with custom HTTP client. SDK is used in `hyperliquid-sdk.service.ts` for: spot metadata, order signing (EIP-712), order placement.

- [ ] Implement order signing (EIP-712)
- [ ] Replace SDK calls with `HyperliquidApiClient` HTTP requests
- [ ] Remove `hyperliquid` package from dependencies

---

## Low Priority

### Trailing (Bull Market Feature)

Data model exists in DB (`trailing_enabled`, `trailing_trigger_percent`, etc.) but execution logic is missing.

- [ ] GridMonitor — continuous loop checking trailing conditions
- [ ] ExecuteTrailing use case
- [ ] Partial position close logic
- [ ] Grid bounds shifting logic

### Edit Grid Scene

- [ ] `EditGridScene`: select parameter → new value → confirm
- [ ] `EditGridCommandEvent` + handler in trading

### Settings

- [ ] `SettingsHandler` menu, `NotificationSettingsHandler` (inline toggles)
- [ ] Store settings in session/DB

### Advanced Notifications

- [ ] Price out-of-range event
- [ ] Daily cron summary (profit per day)
- [ ] Profit target notification

### Documentation

- [ ] Update QUICKSTART.md with actual grid creation examples
- [ ] Document database schema and migrations
- [ ] Create deployment checklist
