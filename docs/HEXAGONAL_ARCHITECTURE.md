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

## Layers

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
├── components/          # Business components — isolated, independently deployable
│   ├── trading/
│   └── telegram/
│
├── apps/                # Deployment compositions — wire components into runnable apps
│   ├── trading-bot/     # trading/ only
│   ├── telegram-ctrl/   # telegram/ only
│   └── all-in-one/      # trading/ + telegram/ in one process
│
├── core/
│   └── domain/          # Shared domain models and services used across components
│       ├── models/
│       └── services/
│
├── adapters/            # Shared technical adapters used by multiple components
│   ├── inbound/         # Shared inbound adapters (health, metrics)
│   └── outbound/        # Shared outbound adapters (DB, cache, events, exchange)
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

### Cross-component communication — Event Bus only

Components **never import each other**. They communicate exclusively through events published
to the event bus (local in-process, or external: Kafka, NATS).

The Event Bus follows the same Ports & Adapters pattern:
- `src/adapters/outbound/events/event-bus.port.ts` — shared port interface + DI token
- `src/adapters/outbound/events/event-bus.adapter.ts` — NestJS EventEmitter (or any other) implementation

```
trading component                        telegram component
─────────────────                        ──────────────────
UseCase                                  adapters/inbound/
  └─ publishes GridCreatedSuccessEvent ──▶  trading-events.controller.ts (subscriber)
                                              └─ calls NotifyUserUseCase
```

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
- Components never import each other — cross-component communication via event bus only

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
- [ ] `core/domain/` has zero imports from `@nestjs/`, `@adapters/`, `application/`, or `adapters/`
- [ ] `core/domain/` has no imports from `@adapters/`, `application/`, or `adapters/`; only `@Injectable()` from NestJS is allowed
- [ ] `core/application/` use cases and services use `@Injectable()`
- [ ] `infra/` modules have no imports from `core/`, `adapters/`, or `components/`
- [ ] Application services that need I/O live in `core/application/services/`, not `core/domain/`
- [ ] Cross-component communication only via event bus — never direct component-to-component imports
