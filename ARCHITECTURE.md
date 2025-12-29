# 🏗️ Bot Architecture

## Overview

Hyperliquid SPOT Grid Bot implements the [SPOT Grid Trading Strategy](./SPOT_GRID_TRADING_ALGORITHM.md) using event-driven architecture for reliable automated trading on Hyperliquid DEX.

**Core Philosophy**: Reliability over speed. Orders must never be lost, state must always be consistent.

**Architecture Pattern**: Hexagonal Architecture with Domain-Driven Design and Event-Driven Communication

---

## 🎯 System Architecture

### High-Level Components

The system consists of two independent components communicating via events:

```
┌─────────────────┐     Events      ┌──────────────┐
│  Notifications  │◄───────────────►│   EventBus   │
│   (Telegram)    │                 └──────▲───────┘
└─────────────────┘                        │Events
                                    ┌──────▼───────┐
                                    │   Trading    │
                                    │ (Core Logic) │
                                    └──────────────┘
                                           │
                                    ┌──────▼───────┐
                                    │  PostgreSQL  │
                                    │   (State)    │
                                    └──────────────┘
```

**1. Trading Component** - Implements grid strategy and order lifecycle management (includes Hyperliquid API integration)
**2. Notifications Component** - User interface via Telegram Bot

**Communication**: All components are decoupled through an in-memory EventBus. No direct dependencies between components.

---

## 🔄 How the System Implements Grid Trading

### Phase 1: Grid Creation

**Trigger**: User sends `/start` command via Telegram

**Flow**:
```
Telegram → CreateGridCommand Event → Trading Component
                                           ↓
                          1. Calculate capital split (50/50 neutral or 30/70 long)
                          2. Calculate price levels (even spacing in range)
                          3. Create grid record (PENDING status)
                                           ↓
                          4. For each level:
                             - Pre-save order record (PENDING)
                             - Place order on exchange
                             - Update order (PLACED)
                                           ↓
                          5. Update grid (RUNNING)
                                           ↓
                          GridCreated Event → Telegram notification
```

**Result**: Buy orders below current price, sell orders above, as described in [grid setup](./SPOT_GRID_TRADING_ALGORITHM.md#step-1-place-initial-orders).

---

### Phase 2: Fill Detection (Continuous)

**Two parallel mechanisms detect order fills:**

#### Mechanism 1: Polling (Reliability)
```
Every 10 seconds (configurable):
  1. Fetch all open orders from exchange
  2. Compare with database state
  3. Detect missing orders = potentially filled/cancelled
  4. Query historical API for exact status
  5. Process status change (filled → trigger refill, cancelled → update status)
```

**Advantage**: Guarantees no missed fills, survives WebSocket downtime

#### Mechanism 2: WebSocket (Speed)
```
Real-time (100-200ms):
  1. Subscribe to userEvents channel (order status changes)
  2. Receive order status event immediately (filled, cancelled, rejected)
  3. Process status change (filled → trigger refill)
```

**Advantage**: 50x faster response enables better capital efficiency

**Why Both?**: Reliability (polling) + Speed (WebSocket). Database constraints prevent duplicate processing.

---

### Phase 3: Order Refill (Profit Cycle)

**Trigger**: Order filled (detected by polling or WebSocket)

**Flow**:
```
Filled Order Detected
        ↓
Update order status (FILLED)
        ↓
Calculate opposite order:
  - If BUY filled → place SELL one level up
  - If SELL filled → place BUY one level down
        ↓
Pre-save order (PENDING) → Place on exchange → Update (PLACED)
        ↓
OrderFilled Event → Telegram notification
```

**Result**: Implements the [profit cycle](./SPOT_GRID_TRADING_ALGORITHM.md#step-2-price-drops--buy-fills) - buy low, sell high, repeat.

---

### Phase 4: Crash Recovery (Continuous)

**Trigger**:
- On bot startup (immediate)
- Every 10 minutes automatically (configurable)

**Flow**:
```
1. Fetch all open orders from exchange
2. For each exchange order:
   - Extract gridId from CLOID
   - Check if order exists in database
   - If missing → create record (recover orphaned order)

3. Find PENDING orders older than threshold (configurable):
   - Query exchange to check if order exists
   - If exchange order exists → update to PLACED
   - If no exchange order → mark as Missing (placement failed)
```

**Why?**: Bot crashes during order placement leave orphaned orders. Without recovery, fills would go undetected and break the grid.

---

## 🏗️ Architectural Layers

### Hexagonal Architecture Pattern

```
┌───────────────────────────────────────────────────────────────┐
│                    Primary Adapters (Inbound)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │   Telegram   │  │   Polling    │  │   WebSocket     │    │
│  │   Events     │  │  Controller  │  │   Controller    │    │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘    │
│         │                 │                    │              │
├─────────▼─────────────────▼────────────────────▼──────────────┤
│                      Core Domain                              │
│                                                                │
│  Grid Creation │ Order Sync │ Status Processing │ Recovery   │
│                                                                │
├────────┬───────────────┬─────────────────┬─────────────┬──────┤
│        │               │                 │             │      │
│  ┌─────▼──────┐  ┌────▼────┐  ┌─────────▼──────┐  ┌──▼────┐ │
│  │ PostgreSQL │  │  Redis  │  │  Hyperliquid   │  │Events │ │
│  │Repository  │  │  Cache  │  │  API Client    │  │ Bus   │ │
│  └────────────┘  └─────────┘  └────────────────┘  └───────┘ │
│                  Secondary Adapters (Outbound)                │
└───────────────────────────────────────────────────────────────┘
```

**Core Domain**: Pure business logic implementing grid strategy - no infrastructure dependencies (currently directly depends on concrete implementations, see TODO.md for decoupling via interfaces)

**Primary Adapters**: Receive external inputs (commands, time triggers, exchange events)

**Secondary Adapters**: Infrastructure implementations (persistence, exchange API, events)

**Benefit**: Core strategy logic can be tested independently, infrastructure can be swapped without changes to business rules.

### Directory Structure and Naming Conventions

**Hexagonal Architecture Mapping**:

```
src/components/trading/
├── controllers/                    # Primary Adapters (Inbound)
│   ├── grid-commands/             # Event-driven grid creation
│   ├── orders-polling/            # Scheduled REST polling (sync orders)
│   ├── orders-websocket/          # Real-time WebSocket events (order status)
│   └── orders-restore/            # Scheduled maintenance (orphaned orders)
│
├── core/                          # Core Domain (Business Logic)
│   ├── domain/                    # Entities and value objects
│   │   ├── grid/                  # Grid entity
│   │   ├── order/                 # Order entity
│   │   ├── exchange-order/        # Exchange-specific order types
│   │   ├── common/                # Shared value objects (Price, Symbol)
│   │   └── user-state/            # User balance and state
│   │
│   ├── use-cases/                 # Business use cases
│   │   ├── create-and-start-grid/ # Grid creation logic
│   │   ├── sync-orders/           # Order synchronization (polling)
│   │   ├── process-order-status/  # Order status processing (WebSocket)
│   │   └── restore-orders/        # Orphaned order recovery
│   │
│   └── services/                  # Domain services
│       ├── capital-calculator/    # Capital distribution (50/50, 30/70)
│       ├── grid-levels-calculator/# Price level calculations
│       ├── order-placement/       # Order placement logic
│       ├── order-refill/          # Refill logic (opposite orders)
│       ├── order-restore/         # Orphaned order recovery logic
│       ├── order-status-sync/     # Status sync logic
│       ├── profit-calculator/     # Profit calculations
│       └── user-balance-extractor/# User balance extraction
│
└── secondary/                     # Secondary Adapters (Outbound)
    ├── client/hyperliquid/        # Hyperliquid API clients
    │   ├── hyperliquid-order.client.ts          # REST order operations
    │   ├── hyperliquid-user-events.client.ts    # WebSocket user events
    │   └── hyperliquid-sdk.service.ts           # SDK wrapper (to be removed)
    │
    └── repository/                # Data persistence
        ├── grid/                  # Grid repository
        └── order/                 # Order repository
```

**Naming Rules**:

- **Controllers** (Primary Adapters): All entry points are named `*.controller.ts`
  - Event-driven controllers (EventBus, WebSocket)
  - Scheduled controllers (cron, intervals)
  - HTTP controllers (future: REST API)

- **Core**: Business logic with no infrastructure dependencies
  - Use cases: `*.use-case.ts`
  - Services: `*.service.ts`
  - Domain models: Plain TypeScript classes

- **Secondary Adapters**: Infrastructure implementations
  - Clients: `*.client.ts` (external APIs)
  - Repositories: `*.repository.ts` (data persistence)
  - Currently use concrete implementations
  - **Planned**: Add interfaces to decouple core from infrastructure (see TODO.md)

---

## 📡 Event-Driven Communication

### Event Flow Example: Order Fill

```
1. WebSocket receives fill
         ↓
2. WebSocket Consumer publishes OrderFilledEvent
         ↓
3. EventBus broadcasts to all subscribers
         ↓
4. Trading Component processes refill
   Notifications Component sends Telegram message
   (Future) Analytics Component logs metrics
```

**Benefits**:
- Components don't know about each other
- Easy to add new functionality (subscribe to events)
- Async, non-blocking processing
- Clear audit trail

---

## 🔐 Critical Design Decisions

### 1. Pre-save Pattern: Order Before Exchange

**Problem**: Bot crashes during order placement → orphaned orders on exchange without database records → fills go undetected → broken grid

**Solution**: Save order to database with PENDING status BEFORE placing on exchange

**Recovery**: OrphanedOrderMonitor matches exchange orders with database, creates missing records

**Trade-off**: Slightly more complex flow, but guarantees no lost orders

---

### 2. CLOID-based Grid Association

**Problem**: Exchange orders have no grid ownership concept → bot restart loses in-memory state → can't match orders to grids

**Solution**: Send gridId as CLOID (Client Order ID) with each exchange order

**Format**: `0x` + hex-encoded UUID without dashes

**Example**: GridId `550e8400-e29b-41d4-a716-446655440000` → CLOID `0x550e8400e29b41d4a716446655440000`

**Recovery**: Read CLOID from exchange orders → decode to UUID → find grid in database

**Note**: Currently using gridId in CLOID. Future improvement: use orderId for better order tracking (see TODO.md)

**Trade-off**: Exchange must support CLOID (Hyperliquid does)

---

### 3. Hybrid Fill Detection

**Problem**:
- WebSocket only = fast but unreliable (disconnections miss fills)
- Polling only = reliable but slow (10s latency hurts capital efficiency)

**Solution**: Run both simultaneously

- WebSocket provides speed (100-200ms)
- Polling provides reliability (guaranteed detection)
- Database constraints prevent duplicate processing

**Trade-off**: Slightly higher resource usage, but best of both worlds

---

### 4. Historical Order API Validation

**Problem**: When order disappears from open orders, is it filled or cancelled?

**Solution**: Query historical orders API to determine exact final status

**Why**: User might manually cancel → assuming filled → incorrect refill → capital leak

**Trade-off**: Extra API call per status change, but guarantees correctness

---

## 🎭 Background Workers

The system runs four independent workers:

### 1. Grid Commands Controller
- **Type**: Event-driven controller
- **Trigger**: `CreateGridCommandEvent` from Telegram bot
- **Action**: Creates grids, places initial orders
- **Implementation**: `GridCommandsController`

### 2. Orders Polling Controller
- **Type**: Scheduled controller (interval)
- **Trigger**: Timer (every 10 seconds, configurable)
- **Action**: Fetches open orders, compares with DB, detects status changes, triggers refills
- **Implementation**: `OrdersPollingController` + `SyncOrdersUseCase`
- **Purpose**: Reliable fill detection

### 3. Orders WebSocket Controller
- **Type**: Real-time WebSocket controller
- **Trigger**: Hyperliquid userEvents WebSocket channel
- **Action**: Processes order status events (filled, cancelled, rejected), triggers refills
- **Implementation**: `OrdersWebsocketController` + `ProcessOrderStatusUseCase`
- **Purpose**: Fast fill detection (100-200ms)

### 4. Orders Restore Controller
- **Type**: Scheduled controller (interval + startup)
- **Trigger**: On startup + Timer (every 10 minutes, configurable)
- **Action**: Recovers orphaned orders from exchange, cleans stale PENDING records
- **Implementation**: `OrdersRestoreController` + `RestoreOrdersUseCase`
- **Purpose**: Crash recovery

All workers are independent and idempotent - safe to run concurrently.

---

## 💾 State Persistence

**Persistent State**: PostgreSQL stores grids and orders with full lifecycle tracking

**Key Principle**: Database is source of truth. All state synchronized with exchange on startup/recovery.

---

## 🚀 Operational Model

### Autonomous Operation

Once grid created, system operates fully autonomously:

✅ **Detects fills** - Hybrid polling + WebSocket
✅ **Places refills** - Opposite orders one level away
✅ **Recovers from crashes** - Orphaned order monitor
✅ **Survives network issues** - Reconnection logic
✅ **Notifies user** - Telegram events

❌ **Trailing** - Not implemented (planned feature)

### Not High-Frequency Trading

System operates on 100ms-10s timescale, not microseconds. Designed for medium-term grid trading, not arbitrage or market making.

---

## 📊 Implementation Status

**Core Grid Trading**: ✅ Complete (~95%)
- Grid creation and initialization
- Order placement with pre-save pattern
- Fill detection (polling + WebSocket)
- Refill logic (opposite orders)
- Crash recovery (orphaned orders)
- Event-driven notifications

**Advanced Features**: ❌ Planned (~20%)
- Trailing (config exists, logic missing)
- Grid stop/pause commands
- Grid status/info queries

---

## 🎯 System Guarantees

**Reliability Guarantees**:
- No lost orders (pre-save pattern)
- No missed fills (hybrid detection)
- Crash recovery (CLOID tracking)
- State consistency (database persistence)

**Performance Characteristics**:
- Fill detection: 100-200ms (WebSocket) or configurable polling interval (default 10s)
- Order placement: 200-500ms per order
- Recovery time: configurable restore interval (default 10 minutes) or immediate on startup

**NOT Guaranteed**:
- Exact fill timing (depends on market)
- Profit amount (depends on volatility)
- Protection from price crashes below grid range

---

**Architecture optimized for reliability and autonomous operation!** 🏗️✨