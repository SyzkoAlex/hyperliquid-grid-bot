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

**Adapter (implementation)** → `{tech}-{feature}.adapter.ts` → `class PostgresGridRepositoryAdapter`

**Use case** → `{feature}.use-case.ts` → `class CreateGridUseCase`

**Domain service** → `{feature}.service.ts` → `class GridCalculatorService`

**Inbound controller** → `{feature}.controller.ts` → `class TelegramCommandsController`

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

#### Synchronous calls — consumer-owned Ports

When a component needs to query another and receive a result synchronously:

- The **consumer** defines an outbound port in its own `adapters/outbound/`
- The **provider** implements that port as an inbound adapter in its `adapters/inbound/`
- The composition root (`apps/all-in-one/`) wires them by providing the adapter under the port token

Example: Telegram needs to fetch current price, run capital calculations, and query trading state
to display in the UI. It defines a service port that Trading implements:

```
telegram/adapters/outbound/
  trading-service.port.ts        ← interface + DI token (owned by telegram)

trading/adapters/inbound/
  telegram/
    trading-service.adapter.ts   ← implements TradingServicePort
```

The port lives in `adapters/outbound/` (not `core/application/ports/`) to clearly distinguish
inter-component dependencies from infrastructure ports (DB, exchange API).

The app module wires the two components:

```typescript
// apps/all-in-one/all-in-one-app.module.ts
const tradingServiceProvider = { provide: TRADING_SERVICE_PORT, useClass: TradingServiceAdapter };
```

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
  └─ publishes CreateGridCommandEvent ──▶  grid-commands.controller.ts (subscriber)

trading component                        telegram component
─────────────────                        ──────────────────
use-cases/create-and-start-grid/         adapters/inbound/
  └─ publishes GridCreatedSuccessEvent ──▶  trading-events.controller.ts (subscriber)
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
- Components never import each other's internals — cross-component calls via consumer-owned ports (sync) or event bus (async)

---

## Inbound Ports

Inbound ports (use case interfaces that inbound adapters depend on) are **optional** in most
projects. Define one only when multiple inbound adapters must satisfy the same contract.
In practice, controllers can inject the use case class directly.

---

## Naming Summary

```
Port interface   →  {feature}.port.ts            interface {Feature}Port
Adapter impl     →  {tech}-{feature}.adapter.ts  class {Tech}{Feature}Adapter
DI token         →  same file as port interface   const {FEATURE}_PORT = Symbol('{FEATURE}_PORT')
Use case         →  {feature}.use-case.ts         class {Feature}UseCase
Domain service   →  {feature}.service.ts          class {Feature}Service
Controller       →  {feature}.controller.ts       class {Feature}Controller
```

---

## Checklist

- [ ] Port file ends with `.port.ts` — interface name ends with `Port`
- [ ] Port file exports a `Symbol` DI token in the same file — token name: `{FEATURE}_PORT`
- [ ] Adapter file ends with `.adapter.ts` — class explicitly `implements XxxPort`
- [ ] Module provides adapter under port token: `{ provide: TOKEN, useClass: Adapter }`
- [ ] Use case injects via `@Inject(TOKEN)` typed as port interface, not concrete class
- [ ] `core/domain/` has zero imports from `@adapters/`, `application/`, or `adapters/`; only `@Injectable()` from `@nestjs/common` is allowed
- [ ] `core/application/` use cases and services use `@Injectable()`
- [ ] `infra/` modules have no imports from `core/`, `adapters/`, or `components/`
- [ ] Application services that need I/O live in `core/application/services/`, not `core/domain/`
- [ ] Synchronous cross-component call → consumer defines port in its `adapters/outbound/`, provider implements it in its `adapters/inbound/`
- [ ] Async cross-component notification → event bus only — never direct component-to-component imports
