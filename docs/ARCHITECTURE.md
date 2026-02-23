# 🏗️ Bot Architecture

## Overview

Hyperliquid SPOT Grid Bot implements the [SPOT Grid Trading Strategy](./SPOT_GRID_TRADING_ALGORITHM.md) using a **modular monolith** architecture for reliable automated trading on Hyperliquid DEX.

**Core Philosophy**: Reliability over speed. Orders must never be lost, state must always be consistent.

The system is a single deployable process (monolith) composed of independently-bounded modules
(Trading, Telegram). Each module enforces [hexagonal architecture](./HEXAGONAL_ARCHITECTURE.md)
internally and communicates with other modules exclusively through ports or the event bus —
never through direct imports.

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
**2. Telegram Component** - User interface via Telegram Bot and notifications

**Communication**: Components are decoupled through two mechanisms — consumer-owned **Ports** for
synchronous calls (e.g. Telegram → Trading commands) and the **EventBus** for async notifications
(e.g. Trading → Telegram events). No direct imports between components.

### Deployment

The system runs as a single **all-in-one** process with both Trading and Telegram components.
Both components share an in-memory EventBus and communicate via in-process ports.

- Command: `pnpm start` or `APP_TYPE=all-in-one`

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

## 📡 Cross-Component Communication

Two complementary patterns keep components decoupled. See
[HEXAGONAL_ARCHITECTURE.md](./HEXAGONAL_ARCHITECTURE.md#cross-component-communication) for the
full explanation and rules.

### Pattern 1 — Ports (synchronous, request/response)

Used when Telegram needs to query Trading synchronously — e.g. fetch current price, run capital
calculations, or read trading state to display in the UI:

```
Telegram component                    Trading component
──────────────────                    ─────────────────
adapters/outbound/                    adapters/inbound/
  trading-service.port.ts   ────────▶   telegram/
  (interface + DI token)                  trading-service.adapter.ts
                                          (implements TradingServicePort)
```

The `apps/all-in-one/` module wires them by providing Trading's adapter under Telegram's port token.

### Pattern 2 — Event Bus (async, fire-and-forget)

Used when Trading needs to notify Telegram (order filled, grid created/stopped):

```
1. WebSocket receives fill
         ↓
2. WebSocket Consumer publishes OrderFilledEvent
         ↓
3. EventBus broadcasts to all subscribers
         ↓
4. Trading Component processes refill
   Telegram Component sends notification to user
```

**Benefits of both patterns combined**:

- Components never import each other's internals
- Synchronous commands get typed, testable return values
- Async notifications remain non-blocking and easy to extend
- Clear audit trail

---

## 🎭 Background Workers

The system runs four independent workers:

### 1. Grid Commands Controller

- **Type**: Event-driven controller
- **Trigger**: `CreateGridCommandEvent` from Telegram bot
- **Action**: Creates grids, places initial orders

### 2. Orders Polling Controller

- **Type**: Scheduled controller (interval)
- **Trigger**: Timer (every 10 seconds, configurable)
- **Action**: Fetches open orders, compares with DB, detects status changes, triggers refills
- **Purpose**: Reliable fill detection

### 3. Orders WebSocket Controller

- **Type**: Real-time WebSocket controller
- **Trigger**: Hyperliquid userEvents WebSocket channel
- **Action**: Processes order status events (filled, cancelled, rejected), triggers refills
- **Purpose**: Fast fill detection (100-200ms)

### 4. Orders Restore Controller

- **Type**: Scheduled controller (interval + startup)
- **Trigger**: On startup + Timer (every 10 minutes, configurable)
- **Action**: Recovers orphaned orders from exchange, cleans stale PENDING records
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