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

- [ ] Add pre-grid-creation balance check in CreateAndStartGridUseCase
- [ ] Define minimum balance thresholds in config:
    - `grid.minInvestmentUSDC` - minimum USDC required
    - `grid.minInvestmentBase` - minimum base token required
- [ ] Validation logic:
    - **Case 1: Sufficient both USDC and base** → Create grid normally
    - **Case 2: Only USDC, no base token** → Consider auto-swap (future feature)
    - **Case 3: Only base, no USDC** → Consider auto-swap (future feature)
    - **Case 4: Insufficient total value** → Throw error with clear message
- [ ] Error messages:
    - "Insufficient balance: need X USDC + Y BASE, have X1 USDC + Y1 BASE"
    - "Total investment too low: minimum XXX USDC equivalent required"

### 3. Auto-Swap Feature (Optional, Future)

- [ ] Research Hyperliquid spot swap/trade API
- [ ] Implement SwapService for USDC ↔ Base token conversion
- [ ] Add swap logic before grid creation:
    - If only USDC → swap 50% to base token
    - If only base → swap 50% to USDC
- [ ] Add config flags:
    - `grid.autoSwapEnabled: boolean`
    - `grid.swapSlippageTolerance: number`

---

## 🏗️ Architecture Improvements

### Decouple Core from Infrastructure via Interfaces

**Current State:** Core layer directly depends on concrete implementations from secondary adapters

**Problem:**

- Use cases import concrete classes (PostgresOrderRepository, HyperliquidOrderClient)
- Cannot easily swap implementations (e.g., mock for tests, different exchange)
- Violates Dependency Inversion Principle

**Solution:**

- [ ] Define port interfaces in `core/domain/ports/`:
    - `IOrderRepository` - order persistence operations
    - `IGridRepository` - grid persistence operations
    - `IExchangeClient` - exchange API operations
    - `IUserStateClient` - user balance/state queries
- [ ] Move interfaces to core layer (ports)
- [ ] Update use cases to depend on interfaces (not concrete classes)
- [ ] Update secondary adapters to implement interfaces
- [ ] Update dependency injection in modules to use tokens/interfaces
- [ ] Update tests to use mock implementations

**Benefits:**

- True hexagonal architecture with ports and adapters
- Easy to test (mock repositories/clients)
- Easy to swap implementations (different exchanges, databases)
- Clear boundaries between core and infrastructure

---

## 🚀 Future Features

### Grid Monitoring Controllers

- [x] Implement OrdersWebSocketConsumer for real-time order updates
- [ ] Implement OrdersMonitorController for periodic sync
- [ ] Implement OrderRestoreMonitorController for restoring lost orders

### Grid Management Commands

- [ ] /stop command - cancel all orders and stop grid
- [ ] /info command - show grid status, P&L, active orders
- [ ] /status command - show all active grids
- [ ] Grid pause/resume functionality

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

### Risk Management

- [ ] Order placement retry logic (3 attempts with backoff)
- [ ] WebSocket reconnection logic
- [ ] Database connection circuit breaker
- [ ] Rate limiting for exchange API

### Unit Tests

- [ ] Unit tests for Grid domain logic
- [ ] Unit tests for all core services
- [ ] Unit tests for all use cases
- [ ] Unit tests for all domain entities

### Documentation

- [ ] Update QUICKSTART.md with actual grid creation examples
- [ ] Add troubleshooting section to README
- [ ] Document database schema and migrations
- [ ] Create deployment checklist
