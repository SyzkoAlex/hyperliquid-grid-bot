# Hexagonal Architecture Guide

## Concept

Hexagonal Architecture (Ports & Adapters) isolates business logic from external systems via
**ports** (interfaces) and **adapters** (implementations). Dependencies always point inward —
the domain knows nothing about infrastructure.

```
  ┌──────────────────────────────────────────────────────────┐
  │                       COMPONENT                          │
  │                                                          │
  │  ┌──────────────┐   ┌──────────────────┐   ┌─────────┐  │
  │  │   inbound    │──▶│   application    │──▶│  ports  │  │
  │  │   adapters   │   │   (use cases)    │   │outbound │  │
  │  └──────────────┘   │   + domain       │   └─────────┘  │
  │                     └──────────────────┘        ▲       │
  └────────────────────────────────────────────────-│───────┘
                                                    │
                                           outbound adapters
                                          (Postgres, Hyperliquid)
```

---

## Layers

### `domain/` — Pure business logic

No framework imports. No I/O. Contains entities, value objects, domain services, and **all outbound
port interfaces** — the contracts that define what the component needs from outside.

```
domain/
  models/           # Entities and Value Objects (Grid, Order, Price)
  services/         # Pure domain logic — calculations, validations, no I/O
  errors/           # Domain-specific errors
  ports/
    outbound/       # All outbound port interfaces (business and technical)
```

All ports — whether business (`OrderRepository`, `ExchangeGateway`) or technical
(`EventPublisher`, `CacheStore`) — live in `domain/ports/outbound/`.

### `application/` — Use Cases

Orchestrates domain services and outbound ports. Knows **what** to call, not **how**.

```
application/
  use-cases/        # One directory per use case
```

### `infra/` — Adapters

All I/O lives here. Adapters implement domain ports and never contain business logic.

```
infra/
  adapters/
    inbound/        # Driving adapters — receive input, call use cases
    outbound/       # Driven adapters — implement domain ports (DB, external APIs)
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
// domain/ports/outbound/grid-repository.port.ts

export const GRID_REPOSITORY_PORT = Symbol('GRID_REPOSITORY_PORT');

export interface GridRepositoryPort {
    save(grid: Grid): Promise<void>;
    findOneById(id: GridId): Promise<Grid | null>;
    findManyActive(): Promise<Grid[]>;
}
```

### Adapter — implements the port

```typescript
// infra/adapters/outbound/persistence/grid/postgres-grid.repository.adapter.ts

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
        @Inject(ORDER_CLIENT_PORT) private readonly orderClient: OrderClientPort,
    ) {}
}
```

---

## Component Directory Structure

```
src/components/{component}/
│
├── domain/
│   ├── models/
│   │   └── grid.ts
│   ├── services/
│   │   └── grid-levels-calculator/
│   │       ├── grid-levels-calculator.service.ts
│   │       └── grid-levels-calculator.service.spec.ts
│   └── ports/
│       └── outbound/
│           ├── grid-repository.port.ts
│           ├── order-repository.port.ts
│           └── order-client.port.ts
│
├── application/
│   └── use-cases/
│       └── create-and-start-grid/
│           ├── create-and-start-grid.use-case.ts
│           ├── create-and-start-grid.use-case.spec.ts
│           └── types/
│               ├── create-and-start-grid-params.ts
│               └── create-and-start-grid-result.ts
│
├── infra/
│   └── adapters/
│       ├── inbound/
│       │   └── telegram-commands/
│       │       └── telegram-commands.controller.ts
│       └── outbound/
│           ├── persistence/
│           │   └── grid/
│           │       ├── postgres-grid.repository.adapter.ts
│           │       ├── postgres-grid.repository.adapter.integration.spec.ts
│           │       └── postgres-grid.repository.module.ts
│           └── exchange/
│               └── hyperliquid/
│                   ├── hyperliquid-order.client.adapter.ts
│                   ├── hyperliquid-order.client.adapter.integration.spec.ts
│                   └── hyperliquid-order.mapper.ts
│
└── {component}.module.ts
```

---

## Global Structure

```
src/
├── components/          # Business components — isolated, independently deployable
│   ├── trading/
│   ├── telegram/
│   └── shared/          # LAST RESORT — see AGENTS.md
│
├── apps/                # Deployment compositions — wire components into runnable apps
│   ├── trading-bot/     # trading/ only
│   ├── telegram-ctrl/   # telegram/ only
│   └── all-in-one/      # trading/ + telegram/ in one process
│
├── domain/              # Shared domain entities (Grid, Order, Price, TradingSymbol)
│
└── infra/               # Shared technical infrastructure (DB, Redis, logger, HTTP)
    └── events/
        ├── event-bus.port.ts       # cross-cutting port
        └── event-bus.adapter.ts    # implements EventBusPort
```

### Cross-component communication — Event Bus only

Components **never import each other**. They communicate exclusively through events published
to the event bus (local in-process, or external: Kafka, NATS).

```
trading component                        telegram component
─────────────────                        ──────────────────
UseCase                                  infra/adapters/inbound/
  └─ publishes GridCreatedSuccessEvent ──▶  trading-events.controller.ts (subscriber)
                                              └─ calls NotifyUserUseCase
```

Each component's inbound adapters handle **two sources of input**:

1. **External triggers** — Telegram commands, HTTP, scheduled jobs
2. **Event bus subscriptions** — events published by other components

Both live in `infra/adapters/inbound/` of the receiving component. This way each component
remains self-contained and can run on a separate server — it just needs access to the shared
event bus transport.

---

## Dependency Direction

```
apps/
    ↓ calls
application/use-cases/
    ↓ calls              ↓ calls (via @Inject token)
domain/services/     domain/ports/outbound/  ◀─ implements ─  infra/adapters/outbound/
    ↓ uses
domain/models/
```

**Hard rules:**

- `domain/` — zero imports from `application/` or `infra/`
- `application/` — zero imports from `infra/`
- `infra/adapters/outbound/` — imports only the port interface, never calls use cases
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
- [ ] `domain/` has zero imports from `application/` or `infra/`
- [ ] Cross-component communication only via event bus — never direct component-to-component imports
