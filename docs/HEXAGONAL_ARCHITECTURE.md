# Hexagonal Architecture Guide

## Concept

https://alistair.cockburn.us/hexagonal-architecture

Hexagonal Architecture (Ports & Adapters) isolates business logic from external systems via
**ports** (interfaces) and **adapters** (implementations). Dependencies always point inward —
the domain knows nothing about infrastructure.

```
  ┌──────────────────────────────────────────────────────────┐
  │                       COMPONENT                          │
  │                                                          │
  │  ┌──────────────┐   ┌──────────────────┐   ┌─────────┐  │
  │  │   inbound    │──▶│   application    │──▶│  ports  │  │
  │  │   adapters   │   │ (use cases +     │   │outbound │  │
  │  └──────────────┘   │  app services)   │   └─────────┘  │
  │                     │   + domain       │        ▲       │
  │                     └──────────────────┘        │       │
  └────────────────────────────────────────────────-│───────┘
                                                    │
                                           outbound adapters
                                          (Postgres, Hyperliquid)
```

---

## Modular Monolith

This codebase is built as a **modular monolith** — a single deployable process composed of
independently-bounded modules (components). Each component owns its domain models, application
layer, and adapters. The boundaries are strict enough that any component could be extracted into
a separate service without a rewrite.

| Property       | This project                    | Microservices               |
|----------------|---------------------------------|-----------------------------|
| Deployment     | Single process                  | Multiple processes          |
| Communication  | In-process (ports + event bus)  | Network (HTTP/gRPC/queues)  |
| Isolation      | Enforced by code discipline     | Enforced by process boundary |
| Ops complexity | Low                             | High                        |

The composition root in `apps/` wires components together into a runnable application.

---

## Layers

The same layer structure applies at **two levels**:

- **Component level** — `src/components/{component}/core/` and `src/components/{component}/adapters/`
  — private to that component, never imported by others.
- **Global level** — `src/core/` and `src/adapters/`
  — shared infrastructure reused across multiple components (domain models, DB, event bus, etc.).

### `core/domain/` — Pure business logic

**Zero external imports.** No `@nestjs/`, no `@adapters/`, no I/O. Contains models and domain
services. All domain services accept plain values — not ports — in their constructors.
If a service needs I/O it belongs in `core/application/services/`, not here.

Domain services are **plain TypeScript classes** with no I/O. They may use `@Injectable()` to
enable standard NestJS DI — convenience matters more than strict framework purity here.
Modules register them as regular providers:

```typescript
// module
CapitalCalculatorService,
```

```
core/domain/
  models/           # Domain models
  services/         # Pure domain logic — calculations, validations, no I/O
  errors/           # Domain-specific errors
```

### `core/application/` — Use Cases and Application Services

Orchestrates domain services and outbound ports. Knows **what** to call, not **how**. This layer
owns the port interfaces — they describe what the application *needs* from the outside world.

Use cases and application services **may use `@Injectable()`** from NestJS. This technically
couples the application layer to the framework, but the DI convenience outweighs the purity here.
No other NestJS decorators or framework concepts belong in this layer.

```
core/application/
  ports/            # Port interfaces + DI tokens (business and technical)
  use-cases/        # One directory per use case
  services/         # Application services — orchestrate via ports (no direct I/O)
```

### `adapters/` — Adapters (inbound and outbound)

All I/O lives here. Adapters implement application ports and never contain business logic.

```
adapters/
  inbound/          # Driving adapters — receive input, call use cases
  outbound/         # Driven adapters — implement ports (DB, external APIs)
```

---

## File Naming

**Port interface** → `{feature}.port.ts` → `interface GridRepositoryPort`

**Outbound adapter** → `{tech}-{feature}.adapter.ts` → `class PostgresGridRepositoryAdapter`

**Inbound adapter** → `{feature}.adapter.ts` → `class TelegramCommandsAdapter`

**Use case** → `{feature}.use-case.ts` → `class CreateGridUseCase`

**Domain service** → `{feature}.service.ts` → `class GridCalculatorService`

**Mapper** → `{feature}.mapper.ts` → `class HyperliquidOrderMapper`

### Port — interface + DI token in one file

TypeScript interfaces are erased at runtime, so each port needs a Symbol token for DI:

```typescript
// core/application/ports/grid-repository.port.ts

export const GRID_REPOSITORY_PORT = Symbol('GRID_REPOSITORY_PORT');

export interface GridRepositoryPort {
    save(grid: Grid): Promise<void>;
    findOneById(id: GridId): Promise<Grid | null>;
    findManyActive(): Promise<Grid[]>;
}
```

### Adapter — implements the port

```typescript
// adapters/outbound/persistence/grid/postgres-grid.repository.adapter.ts

@Injectable()
export class PostgresGridRepositoryAdapter implements GridRepositoryPort {
    // implementation
}
```

```typescript
// module
{ provide: GRID_REPOSITORY_PORT, useClass: PostgresGridRepositoryAdapter }
```

### Use case — injects port by token, never the concrete adapter

```typescript
export class CreateGridUseCase {
    constructor(
        @Inject(GRID_REPOSITORY_PORT) private readonly gridRepo: GridRepositoryPort,
        @Inject(EXCHANGE_CLIENT_PORT) private readonly exchangeClient: ExchangeClientPort,
    ) {}
}
```

---

## Component Directory Structure

```
src/components/{component}/
│
├── api/                           # Public API — the only thing other components may import
│   ├── {component}-api.port.ts   # Port interface + DI token
│   ├── {component}-api.adapter.ts  # Implementation — delegates to internal services
│   └── dto/                       # (optional) plain TS interfaces for cross-boundary data
│       └── {name}.dto.ts
│
├── core/
│   ├── domain/
│   │   ├── models/
│   │   └── services/
│   │
│   └── application/
│       ├── ports/
│       ├── use-cases/
│       └── services/
│
├── adapters/
│   ├── inbound/
│   └── outbound/
│
└── {component}.module.ts
```

---

## Component API (`api/`)

Each component exposes a public surface through an `api/` directory at its root. This is the
**only** directory other components may import from — never `core/`, `adapters/`, or any other
internal path.

### Files

**`api/{component}-api.port.ts`** — the contract (interface + DI token):

```typescript
// api/grids-api.port.ts

export const GRIDS_API_PORT = Symbol('GRIDS_API_PORT');

export interface GridsApiPort {
    saveGrid(grid: Grid): Promise<void>;
    findGridById(id: GridId): Promise<Grid | null>;
    findActiveGrids(): Promise<Grid[]>;
    // ...
}
```

**`api/{component}-api.adapter.ts`** — the implementation, thin wrapper over internal services:

```typescript
// api/grids-api.adapter.ts

@Injectable()
export class GridsApiAdapter implements GridsApiPort {
    constructor(private readonly grids: GridsService) {}

    saveGrid(grid: Grid): Promise<void> {
        return this.grids.saveGrid(grid);
    }
    // ...
}
```

**`api/dto/{name}.dto.ts`** — plain TypeScript interfaces (no domain models) for data that
crosses component boundaries when the component is an autonomous bounded context:

```typescript
// api/dto/user-state.dto.ts

export interface UserStateDto {
    usdcBalance: number;
    spotBalances: Record<string, number>;
}
```

The adapter maps domain objects → DTOs before returning them:

```typescript
async getUserSpotState(user: string): Promise<UserStateDto> {
    const userState = await this.info.getUserSpotState(user);
    return {
        usdcBalance: userState.withdrawableBalance.toNumber(),
        spotBalances: Object.fromEntries(
            userState.assetPositions.map((p) => [p.symbol.toString(), p.size.toNumber()]),
        ),
    };
}
```

**When to use DTOs vs domain objects:**

| Component type | API data | Reason |
|----------------|----------|--------|
| Autonomous bounded context (`trading`) | DTOs — primitives only | Internal domain model must not leak |
| Shared data component (`grids`) | DTOs + shared enums | Entities stay internal; enums are shared for consistency |

### Shared enums

Enums like `GridStatus`, `OrderStatus`, `OrderSide`, `GridMode`, `OrderType` live in
`src/core/domain/models/` and are imported by **all** components directly:

```typescript
import { GridStatus } from '@domain/models/grid/grid-status';
import { OrderSide } from '@domain/models/order/order-side';
```

This keeps status/side/type comparisons type-safe and consistent across component boundaries.
DTOs reference these enums (e.g. `GridDto.status: GridStatus`) so consumers get enum values,
not raw strings.

### Module wiring

The provider registers and exports the token — **no extra wiring in the app module**:

```typescript
// grids.module.ts
@Module({
    providers: [
        { provide: GRIDS_API_PORT, useClass: GridsApiAdapter },
    ],
    exports: [GRIDS_API_PORT],       // ← export the token, not the class
})
export class GridsModule {}
```

### Consumer

The consumer imports the port from the provider's `api/` and injects via the token.
It gets the provider by importing the provider's module:

```typescript
// trading use case — imports from grids api/
import { GRIDS_API_PORT, GridsApiPort } from '@components/grids/api/grids-api.port';

export class SyncOrdersUseCase {
    constructor(
        @Inject(GRIDS_API_PORT) private readonly grids: GridsApiPort,
    ) {}
}

// trading.module.ts
@Module({
    imports: [GridsModule],          // ← GRIDS_API_PORT available via GridsModule.exports
})
export class TradingModule {}
```

### Naming

| File | Interface / Class | DI Token |
|------|-------------------|----------|
| `api/{component}-api.port.ts` | `interface {Component}ApiPort` | `{COMPONENT}_API_PORT` |
| `api/{component}-api.adapter.ts` | `class {Component}ApiAdapter implements {Component}ApiPort` | — |
| `api/dto/{name}.dto.ts` | `interface {Name}Dto` | — |

### Rules

- `api/` is the **only** public surface — other components must never import from `core/` or `adapters/`
- The adapter contains **no business logic** — it delegates to internal services/use cases
- DTOs use primitives only; never expose domain value objects or entities from internal models
- The provider module **exports the token**, never the concrete class
- Consumers import the port file from `@components/{component}/api/` — never from an internal path

---

## Global Structure

```
src/
├── components/          # Business components — each owns its own core/ and adapters/
│   ├── trading/         # Grid strategy, order lifecycle, exchange integration
│   ├── telegram/        # Telegram bot UI, wizard, notifications
│   └── grids/           # Shared data component — grid & order repositories (GRIDS_PORT)
│
├── apps/                # Deployment composition — wires components into a runnable app
│   └── all-in-one/      # trading/ + telegram/ in one process
│
├── core/                # SHARED — domain models and services reused across components
│   └── domain/
│       ├── models/
│       │   ├── grid/        # Shared enums: GridStatus, GridMode
│       │   ├── order/       # Shared enums: OrderStatus, OrderSide, OrderType
│       │   ├── primitives/  # Value objects: TradingSymbol, Price, Decimal, Timestamp
│       │   └── events/      # Domain & command events
│       └── services/
│
├── adapters/            # SHARED — technical adapters reused across components
│   ├── inbound/         # Health, metrics
│   └── outbound/        # DB, cache, event bus, exchange info
│
└── infra/               # Generic infrastructure modules — no business logic, no dependencies
                         # on domain or adapters; candidates to become standalone libraries
```

### Path aliases

| Alias | Points to |
|-------|-----------|
| `@domain/*` | `src/core/domain/*` |
| `@adapters/*` | `src/adapters/*` |
| `@components/*` | `src/components/*` |
| `@apps/*` | `src/apps/*` |

### Cross-component communication

Components never import each other's internals. Communication uses two complementary patterns
depending on whether a result is needed.

#### Synchronous calls — Component API

When a component needs to query another and receive a result synchronously, the **provider**
component exposes a public API. The consumer imports only from `{component}/api/` — never
from the provider's internal directories.

See [Component API (`api/`)](#component-api-api) for the full specification.

#### Async notifications — Event Bus

When a component needs to send commands or notify others without waiting for a result.

The Event Bus is abstracted behind a port so the transport can be swapped without touching
business logic. Current implementation uses an in-process NestJS EventEmitter. The abstraction
exists to allow future replacement with an external queue (Redis Streams, Kafka, NATS) for
horizontal scaling and improved fault tolerance when needed.

The Event Bus follows the same Ports & Adapters pattern:
- `src/infra/events/event-bus.port.ts` — shared port interface + DI token
- `src/adapters/outbound/events/event-bus.adapter.ts` — NestJS EventEmitter (or any other) implementation

```
telegram component                       trading component
──────────────────                       ─────────────────
use-cases/create-grid/                   adapters/inbound/
  └─ publishes CreateGridCommandEvent ──▶  grid-commands.adapter.ts (subscriber)

trading component                        telegram component
─────────────────                        ──────────────────
use-cases/create-and-start-grid/         adapters/inbound/
  └─ publishes GridCreatedSuccessEvent ──▶  trading-events.adapter.ts (subscriber)
                                              └─ calls NotifyUserUseCase
```

#### Which pattern to use

| Scenario                                         | Pattern   |
|--------------------------------------------------|-----------|
| Query data from another component (needs result) | Port      |
| Command that fires and doesn't need a result     | Event Bus |
| Trading/system events to notification layer      | Event Bus |
| Any request/response across components           | Port      |

Each component's inbound adapters handle **two sources of input**:

1. **External triggers** — Telegram commands, HTTP, scheduled jobs
2. **Event bus subscriptions** — events published by other components

Both live in `adapters/inbound/` of the receiving component. This way each component
remains self-contained and can run on a separate server — it just needs access to the shared
event bus transport.

---

## Dependency Direction

```
apps/
    ↓ calls
adapters/inbound/
    ↓ calls
core/application/use-cases/
    ↓ calls              ↓ calls (via @Inject token)
core/application/services/  core/application/ports/  ◀─ implements ─  adapters/outbound/
    ↓ uses
core/domain/services/
    ↓ uses
core/domain/models/
```

**Hard rules:**

- `core/domain/` — zero imports from `@adapters/`, `application/`, or `adapters/`; `@Injectable()` is allowed for DI convenience, no other NestJS decorators
- `core/application/` — zero imports from `adapters/`; `@Injectable()` is allowed on use cases and services
- `adapters/outbound/` — imports only the port interface, never calls use cases
- `infra/` — zero imports from `core/`, `adapters/`, or `components/`
- Components never import each other's internals — sync cross-component calls via `{component}/api/`, async notifications via event bus

---

## Inbound Ports

Inbound ports (use case interfaces that inbound adapters depend on) are **optional** in most
projects. Define one only when multiple inbound adapters must satisfy the same contract.
In practice, controllers can inject the use case class directly.

---

## Naming Summary

```
Port interface      →  {feature}.port.ts              interface {Feature}Port
Outbound adapter    →  {tech}-{feature}.adapter.ts    class {Tech}{Feature}Adapter
Inbound adapter     →  {feature}.adapter.ts            class {Feature}Adapter
DI token            →  same file as port interface     const {FEATURE}_PORT = Symbol('{FEATURE}_PORT')
Use case            →  {feature}.use-case.ts           class {Feature}UseCase
Domain service      →  {feature}.service.ts            class {Feature}Service
```

---

## Checklist

- [ ] Port file ends with `.port.ts` — interface name ends with `Port`
- [ ] Port file exports a `Symbol` DI token in the same file — token name: `{FEATURE}_PORT`
- [ ] Outbound adapter file ends with `.adapter.ts` — class explicitly `implements XxxPort`
- [ ] Inbound adapter file ends with `.adapter.ts` — class calls use cases (no `implements` required)
- [ ] Module provides adapter under port token: `{ provide: TOKEN, useClass: Adapter }`
- [ ] Use case injects via `@Inject(TOKEN)` typed as port interface, not concrete class
- [ ] `core/domain/` has zero imports from `@adapters/`, `application/`, or `adapters/`; only `@Injectable()` from `@nestjs/common` is allowed
- [ ] `core/application/` use cases and services use `@Injectable()`
- [ ] `infra/` modules have no imports from `core/`, `adapters/`, or `components/`
- [ ] Application services that need I/O live in `core/application/services/`, not `core/domain/`
- [ ] Synchronous cross-component call → port in `{component}/api/{component}-api.port.ts`, adapter in `{component}/api/{component}-api.adapter.ts`, module exports the token
- [ ] Other components import **only** from `{component}/api/` and shared `@domain/` — never from `core/`, `adapters/`, or any internal path
- [ ] Cross-boundary data uses DTOs (primitives + shared enums) — never exposes the provider's internal domain entities
- [ ] Shared enums (`GridStatus`, `OrderStatus`, etc.) imported from `@domain/models/` — not duplicated inside components
- [ ] Async cross-component notification → event bus only — never direct component-to-component imports
