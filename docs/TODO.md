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
