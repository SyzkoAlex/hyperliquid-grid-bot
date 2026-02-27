# 📋 TODO - Grid Bot Implementation

## 🎯 Priority Tasks

### 1. Remove Hyperliquid SDK Dependency

**Why:** Reduce external dependencies, full control over API interactions, better type safety

**Current SDK usage (hyperliquid-sdk.service.ts):**

- SDK initialization and connection
- Spot asset map loading (resolves @index to symbol names)
- Order signing and placement via SDK methods

**Implementation plan:**

- [ ] Research Hyperliquid API documentation:
    - REST API endpoints (info, exchange)
    - WebSocket channels (user events, order updates)
    - Order signing algorithm (EIP-712 or similar)
- [ ] Implement HyperliquidHttpClient:
    - GET /info/spot/meta - get spot tokens metadata
    - GET /info/spot/clearinghouseState - get user balances
    - POST /exchange - place/cancel orders
    - Proper request signing with private key
- [ ] Implement order signing:
    - Research Hyperliquid's order structure
    - Implement EIP-712 signing or equivalent
    - Test with testnet orders
- [ ] Replace HyperliquidSdkService with custom implementation:
    - Keep same public interface for minimal changes
    - Store spot asset map in-memory (lazy load on first use)
    - Use HttpService for REST API calls
- [ ] Update HyperliquidOrderClient to use new implementation
- [ ] Test all operations on testnet
- [ ] Remove `hyperliquid` package from dependencies

### 2. Balance Validation and Auto-Swap Before Grid Creation

**Problem:** Currently no validation if user has sufficient balance for grid creation

**Solution Strategy:**

- [x] Add pre-grid-creation balance check in CreateAndStartGridUseCase
    - Validates calculated `investmentUSDC` and `investmentBase` vs actual balances
    - Throws with amount-specific error messages (e.g. "Required: X, Available: Y")
    - Config-driven min thresholds were not added — validation uses calculated amounts directly (simpler and correct)
- [ ] Validation logic — Cases 2 & 3 (auto-swap) → see Task 3 below
- [ ] Error messages in Telegram scene — surface `create-and-start-grid` errors to user

### 3. Auto-Swap Feature (Optional, Future)

- [ ] Research Hyperliquid spot swap/trade API
- [ ] Implement SwapService for USDC ↔ Base token conversion
- [ ] Add swap logic before grid creation:
    - If only USDC → swap 50% to base token
    - If only base → swap 50% to USDC
- [ ] Add config flags:
    - `grid.autoSwapEnabled: boolean`
    - `grid.swapSlippageTolerance: number`

### 4. Rework GridPnlCalculatorService

**File:** `src/domain/services/grid-pnl-calculator/grid-pnl-calculator.service.ts:18`

**Problem:** The current implementation only computes a naive `sellVolume − buyVolume` diff without fees, unrealized PnL, or HODL comparison. This gives a misleading picture of actual bot performance.

**Reference:** `docs/GRID-PNL-CALCULATION.md`

- [ ] Track cumulative fees paid per grid and subtract them from realized grid profit
- [ ] Add `unrealizedPnl` calculation: `Qty_held × (currentPrice − avgBuyPrice)`
- [ ] Add `totalPnl = currentEquity − initialInvestment` as the primary metric
- [ ] Add `vsHodl = currentEquity − hodlEquity` comparison
- [ ] Expose `gridProfitNet`, `unrealizedPnl`, `totalPnl`, `vsHodl` from the service
- [ ] Add breakeven check: warn if `gridStep / avgPrice < 2 × feeRate`
- [ ] Cover new logic with unit tests

---

## 🏗️ Architecture Improvements

### Decouple Core from Infrastructure via Interfaces

**Status:** ✅ Completed

- [x] Port interfaces defined:
    - `@domain/ports/outbound/info-client.port.ts` → `InfoClientPort` / `INFO_CLIENT_PORT`
    - `@components/trading/domain/ports/outbound/grid-repository.port.ts` → `GridRepositoryPort` / `GRID_REPOSITORY_PORT`
    - `@components/trading/domain/ports/outbound/order-repository.port.ts` → `OrderRepositoryPort` / `ORDER_REPOSITORY_PORT`
    - `@components/trading/domain/ports/outbound/order-client.port.ts` → `OrderClientPort` / `ORDER_CLIENT_PORT`
    - `@components/telegram/domain/ports/outbound/grid-repository.port.ts`
    - `@components/telegram/domain/ports/outbound/order-repository.port.ts`
- [x] Use cases use `@Inject(PORT_TOKEN)` (not concrete classes): `CreateAndStartGridUseCase`, `SyncOrdersUseCase`, `RestoreOrdersUseCase`, etc.
- [x] Secondary adapters implement port interfaces
- [x] Tests use mock implementations via NestJS DI

---

## 🚀 Future Features

### Grid Monitoring Controllers

- [x] Implement OrdersWebSocketConsumer for real-time order updates
- [x] Implement OrdersMonitorController for periodic sync
- [x] Implement OrderRestoreMonitorController for restoring lost orders

### Telegram Bot Features

- [x] `/start` — welcome message + main menu
- [x] `/help` — FAQ
- [x] `/grids` — list active grids with PnL cards
- [x] Grid View — details + stop confirmation flow
- [x] Stop Grid — `StopGridCommandEvent` → trading component handles cancellation
- [x] Create Grid Scene — 9-step wizard (select-pair → mode → params → confirm)
- [x] Global error handler middleware — catches unhandled errors, replies with friendly message, prevents crash
- [x] Callback dedup middleware — prevents duplicate handler execution on rapid button clicks

#### Grid View rework (Phase 5, GRID-PNL-CALCULATION.md)

- [ ] **Rework `GridPnlCalculatorService`**: `calculate(orders, currentPrice) → { gridProfit, unrealizedPnl }`
    - `gridProfit` = Σ(filled_sell × price) − Σ(filled_buy × price)
    - `unrealizedPnl` = qtyHeld × (currentPrice − avgBuyPrice)
    - Update unit tests
- [ ] **Extend `GridWithPnl`**: replace `pnl: number` + `profitableTrades` with `pnl: GridPnl` + `orderStats: OrderStats`
    - `OrderStats`: `activeBuys`, `activeSells`, `avgActiveBuyPrice`, `avgActiveSellPrice`, `lowestActiveBuyPrice`, `highestActiveSellPrice`, `filledCycles`
- [ ] **Update use cases**: `GetGridsWithPnlUseCase`, `GetGridWithPnlUseCase` — pass `currentPrice`, compute `orderStats`
- [ ] **Tab navigation** in `GridViewHandler`: `view:grid:{id}:profit` + `view:grid:{id}:orders` actions
    - Profit tab: Total PnL · Grid Profit · Grid APR · Unrealized · Profitable Trades · range/price/started
    - Orders tab: active buy/sell counts, avg prices, lowest buy / highest sell, current price
    - Keyboard: `[📊 Profit] [📋 Orders]` + `[🔴 Stop] [← Back]`
- [ ] **Update `GridListItemMessage`**: show Total PnL first, then Grid Profit + Unrealized, compact orders line
- [ ] Update specs: `grid-list-item.message.spec.ts`, `get-grids-with-pnl.use-case.spec.ts`

#### Next up

- [ ] `/balance` — show USDC + token positions (stub: "Coming soon")
- [ ] `/stats` — aggregated PnL across all grids (stub: "Coming soon")
- [ ] Grid Resume — `ResumeGridCommandEvent` + confirm flow
- [ ] Grid History — last 10 fills for a grid
- [ ] `/settings` — notification toggles (stub: "Coming soon")

### Technical Improvements

- [x] Pass order ID to exchange's cloid instead of grid ID
    - **Status:** ✅ Completed
    - **Implementation:**
        - ExchangeCloid now uses OrderId instead of GridId
        - CLOID is calculated on-the-fly from order ID, not stored in database
        - Optimized sync-orders use case with bulk queries to avoid N+1 problem
    - **Files changed:**
        - `exchange-cloid.ts` - changed to use OrderId with parse/create methods
        - `sync-orders.use-case.ts` - refactored for bulk order fetching and grouping
        - `postgres-order.repository.ts` - added findManyByIds method
        - `postgres-grid.repository.ts` - added findManyActiveByIds method
        - `orders.schema.ts` - removed cloid column (calculated on-the-fly)
        - All test files updated to reflect new architecture

### Trailing (Bull Market Feature)

- [ ] GridMonitor - continuous loop checking trailing conditions
- [ ] ExecuteTrailing use case
- [ ] Partial position close logic
- [ ] Grid bounds shifting logic

### Cancel Orphaned Exchange Orders in Order Restore

**Problem:** When a grid is stopped, some orders may not get cancelled on the exchange (e.g. network error, partial failure). These orphaned orders remain active on the exchange with no corresponding active grid, and can get filled unexpectedly (causing "Insufficient spot balance" errors for other grids).

**Solution:** In `OrderRestoreService.restoreOrders()`, after restoring pending orders, also detect and cancel orphaned exchange orders:

- [ ] Fetch all active exchange orders (already available as `exchangeOpenOrders` param)
- [ ] For each exchange order with a valid cloid, resolve the associated grid
- [ ] If the grid is stopped/not found — cancel the order on the exchange
- [ ] Log cancelled orphaned orders with grid/order details

### Risk Management

- [ ] Order placement retry logic (3 attempts with backoff)
- [ ] WebSocket reconnection logic
- [ ] Database connection circuit breaker
- [ ] Rate limiting for exchange API

### Unit Tests

- [x] Unit tests for CreateGridScene steps (all 9 steps)
- [x] Unit tests for WizardMessageManager, WizardNavigator
- [x] Unit tests for GetGridsWithPnlUseCase
- [ ] Unit tests for Grid domain logic
- [ ] Unit tests for all core services
- [ ] Unit tests for remaining use cases
- [ ] Unit tests for all domain entities

### Documentation

- [ ] Update QUICKSTART.md with actual grid creation examples
- [ ] Add troubleshooting section to README
- [ ] Document database schema and migrations
- [ ] Create deployment checklist
