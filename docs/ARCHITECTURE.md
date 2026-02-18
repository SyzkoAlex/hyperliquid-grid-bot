# 🏗️ Bot Architecture

## Overview

Hyperliquid SPOT Grid Bot implements the [SPOT Grid Trading Strategy](./SPOT_GRID_TRADING_ALGORITHM.md) using event-driven architecture for reliable automated trading on Hyperliquid DEX.

**Core Philosophy**: Reliability over speed. Orders must never be lost, state must always be consistent.

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

**Communication**: All components are decoupled through an in-memory EventBus. No direct dependencies between components.

### Deployment Modes

The system supports three deployment modes:

**1. All-In-One Mode (`all-in-one`)** - Single process running both components

- Both Trading and Telegram components in one Node.js process
- In-memory EventBus enables communication between components
- Simplest deployment for development and small-scale usage
- Command: `pnpm start:all-in-one` or `APP_TYPE=all-in-one`

**2. Trading Bot Only (`trading-bot`)** - Trading component standalone

- Runs only grid trading logic and order processing
- Requires external EventBus (future: Redis/Kafka) for production multi-process setup
- Command: `pnpm start:trading-bot` or `APP_TYPE=trading-bot`

**3. Telegram Control Only (`telegram-ctrl`)** - Telegram interface standalone

- Runs only Telegram bot for notifications and commands
- Requires external EventBus (future: Redis/Kafka) for production multi-process setup
- Command: `pnpm start:telegram-ctrl` or `APP_TYPE=telegram-ctrl`

**Current Limitation**: Since EventBus is in-memory, separate processes (modes 2 & 3) cannot communicate. For production deployment with separate processes, use All-In-One mode OR implement distributed EventBus adapter (planned).

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
