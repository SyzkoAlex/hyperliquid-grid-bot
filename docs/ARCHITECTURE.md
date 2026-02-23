# 🏗️ Bot Architecture

## Overview

Hyperliquid SPOT Grid Bot implements the [SPOT Grid Trading Strategy](./SPOT_GRID_TRADING_ALGORITHM.md) using a **modular monolith** architecture for reliable automated trading on Hyperliquid DEX.

**Core Philosophy**: Reliability over speed. Orders must never be lost, state must always be consistent.

The system is a single deployable process (monolith) composed of independently-bounded modules
(Trading, Telegram, Grids). Each module enforces [hexagonal architecture](./HEXAGONAL_ARCHITECTURE.md)
internally and communicates with other modules exclusively through the event bus —
never through direct imports.

---

## 🎯 System Architecture

### Components

```
┌──────────────────────────────────────────────────────────────────┐
│                          all-in-one process                       │
│                                                                   │
│  ┌─────────────────────┐              ┌────────────────────────┐  │
│  │   Telegram          │              │   Trading              │  │
│  │                     │──commands──▶ │                        │  │
│  │  Bot + Wizard       │◀──events──── │  Grid lifecycle        │  │
│  │  Notifications      │              │  Order management      │  │
│  └──────────┬──────────┘              └──────────┬─────────────┘  │
│             │                                    │               │
│             └──────────────┬───────────────────  │               │
│                            │                     │               │
│                  ┌─────────▼──────────┐          │               │
│                  │  EventBus          │          │               │
│                  │  (in-process)      │          │               │
│                  └────────────────────┘          │               │
│                                                  │               │
│             ┌────────────────────────────────────┘               │
│             │                                                     │
│  ┌──────────▼──────────────────────────────────────────────────┐ │
│  │              Grids (shared component)                        │ │
│  │     Grid & Order repositories — accessed via GRIDS_PORT      │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
└──────────────────┬────────────────────────────────┬──────────────┘
                   │                                │
          ┌────────▼────────┐             ┌─────────▼──────────┐
          │   PostgreSQL    │             │   Hyperliquid DEX  │
          │  grids, orders  │             │  REST + WebSocket  │
          └─────────────────┘             └────────────────────┘
                   │
          ┌────────▼────────┐
          │     Redis       │
          │ Telegram session│
          └─────────────────┘
```

**Trading** — implements the grid strategy: places initial orders, detects fills, places refill
orders, recovers orphaned orders, cancels orders on grid stop.

**Telegram** — user interface: multi-step Create Grid wizard, grid list and detail views,
real-time notifications (order fills, grid events).

**Grids** — shared data component: exposes `GRIDS_PORT` used by both Trading and Telegram to
read and write grid/order state. Neither Trading nor Telegram accesses the DB directly.

### External Services

| Service | Used by | Purpose |
|---------|---------|---------|
| PostgreSQL | Grids component | Persistent state — grids and orders |
| Redis | Telegram component | Telegram bot session storage (wizard state) |
| Hyperliquid REST API | Trading component | Place and cancel orders |
| Hyperliquid WebSocket | Trading component | Real-time order status events |

### Deployment

The system runs as a single **all-in-one** process.

- Production: `pnpm start`
- Development: `pnpm start:dev`

---

## 🔄 Grid Lifecycle

### Phase 1: Grid Creation

**Trigger**: User completes the Create Grid wizard in Telegram and confirms

**Flow**:

```
Telegram wizard confirms
        ↓
CreateGridUseCase publishes CreateGridCommandEvent
        ↓
Trading: GridCommandsController receives event
        ↓
CreateAndStartGridUseCase:
  1. Calculate capital split (50/50 neutral or 30/70 long)
  2. Calculate price levels (even spacing in range)
  3. Save grid record (status: PENDING)
  4. For each level:
       - Save order record (PENDING)
       - Place order on Hyperliquid
       - Update order (PLACED)
  5. Update grid (status: RUNNING)
        ↓
Publish GridCreatedSuccessEvent (or GridCreatedErrorEvent on failure)
        ↓
Telegram: trading-events controller → NotifyUserUseCase → send notification
```

**Result**: Buy orders placed below current price, sell orders above. See
[grid setup](./SPOT_GRID_TRADING_ALGORITHM.md#step-1-place-initial-orders).

---

### Phase 2: Fill Detection (Continuous)

**Two parallel mechanisms detect order fills:**

#### Mechanism 1: Polling (Reliability)

```
Every 10 seconds (configurable):
  1. Fetch all open orders from exchange
  2. Compare with database state
  3. Missing orders = potentially filled/cancelled
  4. Query historical API for exact status
  5. Process status change (filled → trigger refill, cancelled → update status)
```

**Advantage**: Guarantees no missed fills, survives WebSocket downtime.

#### Mechanism 2: WebSocket (Speed)

```
Real-time (100-200ms):
  1. Subscribe to Hyperliquid userEvents channel
  2. Receive order fill/cancel/reject event immediately
  3. Process status change (filled → trigger refill)
```

**Advantage**: 50x faster response, better capital efficiency.

**Why both?** Reliability (polling) + Speed (WebSocket). DB constraints prevent duplicate processing.

---

### Phase 3: Order Refill (Profit Cycle)

**Trigger**: Order fill detected by polling or WebSocket

**Flow**:

```
Fill detected
      ↓
Update order status (FILLED)
      ↓
Calculate opposite order:
  BUY filled  → place SELL one level up
  SELL filled → place BUY one level down
      ↓
Save order (PENDING) → place on exchange → update (PLACED)
      ↓
Publish OrderOpenedEvent → Telegram notification
```

**Result**: Buy low, sell high, repeat. See
[profit cycle](./SPOT_GRID_TRADING_ALGORITHM.md#step-2-price-drops--buy-fills).

---

### Phase 4: Grid Stop

**Trigger**: User confirms stop in Telegram grid detail view

**Flow**:

```
User confirms stop
      ↓
Telegram: StopGridUseCase publishes StopGridCommandEvent
      ↓
Trading: GridCommandsController receives event
      ↓
Trading: StopGridUseCase:
  1. Fetch grid and all active orders
  2. Cancel each active order on Hyperliquid
  3. Update grid status (STOPPED)
```

---

### Phase 5: Crash Recovery (Continuous)

**Trigger**: On startup (immediate) + every 10 minutes (configurable)

**Flow**:

```
1. Fetch all open orders from exchange
2. For each exchange order:
     - Extract gridId from CLOID
     - If order missing in DB → create record (recover orphaned order)

3. Find PENDING orders older than threshold:
     - Exchange order exists → update to PLACED
     - No exchange order    → mark as Missing (placement failed)
```

**Why?** Bot crashes during order placement leave orphaned orders — fills go undetected and break the grid.

---

## 📡 Cross-Component Communication

Components communicate exclusively through the **EventBus** — never via direct imports.

| Event | Publisher | Subscriber |
|-------|-----------|------------|
| `CreateGridCommandEvent` | Telegram | Trading (GridCommandsController) |
| `StopGridCommandEvent` | Telegram | Trading (GridCommandsController) |
| `GridCreatedSuccessEvent` | Trading | Telegram (trading-events controller) |
| `GridCreatedErrorEvent` | Trading | Telegram (trading-events controller) |
| `OrderOpenedEvent` | Trading | Telegram (trading-events controller) |
| `OrderClosedEvent` | Trading | Telegram (trading-events controller) |

The EventBus is abstracted behind a port (`src/infra/events/event-bus.port.ts`) so the
in-process NestJS EventEmitter can be swapped for an external queue (Redis Streams, Kafka, NATS)
without touching business logic. See [HEXAGONAL_ARCHITECTURE.md](./HEXAGONAL_ARCHITECTURE.md#cross-component-communication).

---

## 🎭 Background Workers

The system runs four independent workers in the Trading component:

### 1. Grid Commands Controller

- **Type**: Event-driven
- **Trigger**: `CreateGridCommandEvent` / `StopGridCommandEvent` from EventBus
- **Action**: Creates and starts grids, stops grids and cancels their orders

### 2. Orders Polling Controller

- **Type**: Scheduled (interval)
- **Trigger**: Every 10 seconds (configurable via `ORDERS_POLL_INTERVAL_MS`)
- **Action**: Fetches open orders, compares with DB, detects fills/cancels, triggers refills
- **Purpose**: Reliable fill detection

### 3. Orders WebSocket Controller

- **Type**: Real-time WebSocket
- **Trigger**: Hyperliquid `userEvents` WebSocket channel
- **Action**: Processes order status events (filled, cancelled, rejected), triggers refills
- **Purpose**: Fast fill detection (100–200ms)

### 4. Orders Restore Controller

- **Type**: Scheduled + startup
- **Trigger**: On startup + every 10 minutes (configurable via `ORDERS_RECOVERY_INTERVAL_MS`)
- **Action**: Recovers orphaned orders, cleans stale PENDING records
- **Purpose**: Crash recovery

All workers are independent and idempotent — safe to run concurrently.

---

## 💾 State Persistence

| Store | Data | Notes |
|-------|------|-------|
| PostgreSQL | Grids, Orders | Source of truth. State synchronized with exchange on startup/recovery |
| Redis | Telegram session | Wizard state per user, TTL configurable (`TELEGRAM_SESSION_TTL_SECONDS`) |

---

## 🚀 Operational Model

### Autonomous Operation

Once a grid is created, the system operates fully autonomously:

✅ **Detects fills** — hybrid polling + WebSocket
✅ **Places refills** — opposite orders one level away
✅ **Recovers from crashes** — orphaned order monitor
✅ **Survives network issues** — reconnection logic
✅ **Notifies user** — Telegram events

❌ **Trailing** — not implemented (planned)

### Not High-Frequency Trading

System operates on 100ms–10s timescale, not microseconds. Designed for medium-term grid trading,
not arbitrage or market making.
