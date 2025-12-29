# 🤖 AI Agent Guidelines

## ⚠️ MANDATORY: Run QA Check After Changes

```bash
pnpm qa:check
```

This runs: typecheck → lint → format:check → build → test

**Do NOT commit**

---

## ⚠️ UNIVERSAL PRINCIPLE - MINIMALISM (CRITICAL)

**Apply to EVERYTHING LLM writes: code, comments, responses, rules, documentation**

- IF writing code → THEN write MINIMUM necessary (avoid verbosity, over-engineering)
- IF functionality exists → THEN do NOT duplicate (reuse or omit)
- IF 3+ similar patterns → THEN extract to ONE function/module/rule
- IF logic is self-evident → THEN do NOT add comment
- IF explaining → THEN show code example, NOT prose

**Examples:**

❌ BAD (verbose, over-commented):
```typescript
// This function validates user email address
// It checks if email is not empty or null
// It checks if email contains @ symbol
// Returns true if valid, false otherwise
function validateEmail(email: string): boolean {
  // Check if email exists
  if (!email) return false
  // Check if email has @ symbol
  if (!email.includes('@')) return false
  // Email is valid
  return true
}
```

✅ GOOD (concise, self-documenting):
```typescript
function validateEmail(email: string): boolean {
  return email?.includes('@') ?? false
}
```

## File Organization

- IF file → THEN one exported class/interface/type per file
- IF file has multiple declarations → THEN allowed ONLY if ONE has `export`
- IF internal helper → THEN do NOT export

## Architecture Placement

- IF code needed in BOTH primary AND secondary adapters → THEN move to `infra/`
- IF technical concern (lock, cache, metrics, etc.) → THEN place in `infra/`
- IF business logic → THEN place in `core/`
- IF external system integration → THEN place in `secondary/`

## Unknown Code Discovery

- IF unknown class/function/type → THEN first check npm/standard library, then GitHub (see `@github-search.mdc`)
- IF local search returns nothing → THEN always try GitHub search before asking user

## Comments

- IF code file → THEN do NOT write comments in code
- IF code → THEN use self-documenting names (classes, methods, variables)
- IF code → THEN use descriptive names instead of comments
- IF code → THEN code should be clear without comments
- IF comment is needed → THEN refactor code to be more self-explanatory
- IF rare exception → THEN comment only when absolutely necessary (very rare)

## Naming Convention

- IF class → THEN use descriptive name that explains purpose
- IF method → THEN use verb + noun pattern (e.g., `saveSecret`, `getSecrets`)
- IF variable → THEN use descriptive name that explains what it contains
- IF boolean → THEN use `is`, `has`, `can`, `should` prefix (e.g., `isValid`, `hasPermission`)
- IF function → THEN name should clearly describe what it does
- IF repository method returns single entity → THEN use `findOne*` prefix (e.g., `findOneById`, `findOneByEmail`)
- IF repository method returns multiple entities → THEN use `findMany*` prefix (e.g., `findManyActive`, `findManyByStatus`)

**Repository Method Naming:**

```typescript
// ✅ GOOD - Explicit return type in method name
async findOneById(id: GridId): Promise<Grid | null>
async findManyActive(): Promise<Grid[]>
async findOneByExchangeOrderId(exchangeOrderId: string): Promise<Order | null>
async findManyPendingByGridId(gridId: string): Promise<Order[]>

// ❌ BAD - Unclear return type
async findById(id: GridId): Promise<Grid | null>
async findActive(): Promise<Grid[]>
async findByExchangeOrderId(exchangeOrderId: string): Promise<Order | null>
```

## Code Clarity

- IF code → THEN prefer clear code over commented code
- IF complex logic → THEN extract to well-named method instead of commenting
- IF magic numbers → THEN use named constants instead of comments
- IF business rule → THEN express in code structure, not in comments

## Result Objects

- IF result object with mutable counters/flags → THEN use class with methods instead of interface
- IF initializing result object → THEN use static factory method `empty()` instead of object literal
- IF updating result counters → THEN use increment methods instead of direct property access
- IF result object collects items → THEN use add methods instead of direct array manipulation

**Examples:**

❌ BAD (interface with direct property mutation):
```typescript
export interface GridProcessResult {
    fills: number;
    cancellations: number;
    refills: number;
}

const result: GridProcessResult = { fills: 0, cancellations: 0, refills: 0 };
result.fills++;
result.cancellations++;
```

✅ GOOD (class with methods):
```typescript
export class GridProcessResult {
    public fills: number;
    public cancellations: number;
    public refills: number;

    constructor(fills: number = 0, cancellations: number = 0, refills: number = 0) {
        this.fills = fills;
        this.cancellations = cancellations;
        this.refills = refills;
    }

    static empty(): GridProcessResult {
        return new GridProcessResult();
    }

    incrementFills(value: number = 1): void {
        this.fills += value;
    }

    incrementCancellations(value: number = 1): void {
        this.cancellations += value;
    }
}

const result = GridProcessResult.empty();
result.incrementFills();
result.incrementCancellations();
```

✅ GOOD (class with array collection):
```typescript
export class OrderSyncResult {
    public filledOrders: Order[];
    public fills: number;
    public cancellations: number;

    constructor(filledOrders: Order[] = [], fills: number = 0, cancellations: number = 0) {
        this.filledOrders = filledOrders;
        this.fills = fills;
        this.cancellations = cancellations;
    }

    static empty(): OrderSyncResult {
        return new OrderSyncResult();
    }

    addFilledOrder(order: Order): void {
        this.filledOrders.push(order);
    }

    incrementFills(value: number = 1): void {
        this.fills += value;
    }
}

const result = OrderSyncResult.empty();
result.addFilledOrder(order);
result.incrementFills();
```

## Getters and Setters

- IF getter only returns private field without logic → THEN use `readonly` public property instead
- IF setter only assigns value without logic → THEN use public property instead
- IF getter/setter has validation, transformation, or side effects → THEN getter/setter is appropriate

**Examples:**

❌ BAD (useless getter):
```typescript
class Config {
  private _baseTopic: string
  
  baseTopic(): string {
    return this._baseTopic
  }
}
```

✅ GOOD (direct readonly property):
```typescript
class Config {
  readonly baseTopic: string
}
```

✅ GOOD (getter with logic is appropriate):
```typescript
class Config {
  private _items: Item[]
  
  get itemCount(): number {
    return this._items.length
  }
}
```

## Constructor Parameter Properties

- IF class has readonly fields → THEN use constructor parameter properties instead of private constructor + manual assignment
- IF class needs only simple field initialization → THEN use public constructor with parameter properties
- IF class needs validation or complex initialization → THEN private constructor + static factory is appropriate

**Examples:**

❌ BAD (unnecessary boilerplate):
```typescript
class RefillParams {
  readonly side: OrderSide
  readonly levelIndex: number
  readonly price: number

  private constructor(side: OrderSide, levelIndex: number, price: number) {
    this.side = side
    this.levelIndex = levelIndex
    this.price = price
  }
}
```

✅ GOOD (concise parameter properties):
```typescript
class RefillParams {
  constructor(
    readonly side: OrderSide,
    readonly levelIndex: number,
    readonly price: number,
  ) {}
}
```

✅ GOOD (private constructor when needed for validation):
```typescript
class Price {
  private constructor(readonly value: number) {
    if (value < 0) throw new Error('Price cannot be negative')
  }

  static from(value: number): Price {
    return new Price(value)
  }
}
```

## Logging

- IF make log, print somthing to console → THEN do NOT use `console.log` or direct `logger` calls

```typescript
// define in class
private readonly logger = logger.context(ClassName.name)

// use for print, logging
this.logger.debug()
this.logger.info()
this.logger.warn()
this.logger.error()
```

- IF bootstrapEventsConsumerApp function or utility function (NOT class) → THEN can use direct `logger` calls (e.g., `bootstrap-api.ts`, bootstrapEventsConsumerApp functions)
- IF exception filter → THEN can use direct `logger` calls (filters are special cases)


## 🏗️ Architecture Rules

### Component Independence

- Components in `src/components/` are INDEPENDENT
- NO imports between components
- Communication via EventBus only

### Call Chain

```
Controllers → Use Cases → Services (Core or Secondary)
```

**Rules:**

- ✅ Controllers call Use Cases ONLY
- ✅ Use Cases call Services (core/services/ or secondary/)
- ✅ Services call Secondary Adapters
- ❌ Controllers NEVER call Services directly
- ❌ Controllers NEVER call Secondary Adapters directly
- ❌ Use Cases NEVER call other Use Cases
- ❌ Use Cases NEVER call Secondary Adapters directly (use Services)
- ❌ Components NEVER import other components

**Correct Flow:**

```
Controller
    ↓
Use Case (business logic)
    ↓
Service (orchestration or adapter wrapper)
    ↓
Secondary Adapter (external API/DB)
```

### Controllers

**Controllers are the entry points from external systems (HTTP, EventBus, CLI, etc.)**

**Responsibilities:**

- ✅ Call Use Cases ONLY (never Services directly)
- ✅ Handle protocol-level concerns (command routing, error logging, request validation)
- ✅ Publish notification events (result of use case execution)
- ✅ Subscribe to command events via EventBus
- ❌ NEVER call Services directly
- ❌ NEVER call Secondary Adapters directly
- ❌ NEVER contain business logic (delegate to Use Cases)

**Example:**

```typescript
// ✅ GOOD - Controller calls Use Case and publishes notification
@Injectable()
export class GridController {
    constructor(
        private readonly createAndStartGrid: CreateAndStartGridUseCase,
        private readonly eventBus: EventBus,
    ) {}

    async handleCreateGrid(command: CreateGridCommand) {
        try {
            const result = await this.createAndStartGrid.execute(command);
            this.eventBus.publish(new GridCreatedSuccessEvent(result)); // Notification
        } catch (error) {
            this.eventBus.publish(new GridCreatedErrorEvent(error));
        }
    }
}
```

### Services for Shared Logic

**Two types of Services:**

1. **Core Services** (`core/services/`) - Business logic shared between use cases
    - Example: `CapitalCalculatorService`, `GridOrchestrationService`
    - Pure domain logic
    - Called ONLY by Use Cases (not Controllers)
    - CAN call only other Services (Core or Secondary)
    - ❌ NEVER call Use Cases

2. **Secondary Services** (in `secondary/`) - Wrappers for external systems
    - Example: `HyperliquidOrderClient`, `PostgresGridRepository`
    - Handle external communication
    - Called only by Use Cases or Core Services
    - ❌ NEVER call Use Cases

**When to use Services:**

- Shared code between use cases → Core Service
- Large use case → split into Core Services
- External API/DB access → Secondary Service/Adapter

### Event Publishing

**Two types of events:**

1. **Domain Events** - Business logic events (e.g., `GridStartedEvent`, `TradeExecutedEvent`)
    - ✅ Published by Use Cases or Services
    - ❌ NEVER published by Controllers
    - Purpose: Notify about business state changes

2. **Notification Events** - UI/Integration events (e.g., `GridCreatedSuccessEvent`, `GridCreatedErrorEvent`)
    - ✅ Published by Controllers after use case execution
    - Purpose: Notify external systems (Telegram, UI) about operation results

**Rules:**

- ✅ Controllers publish notification events (result of use case execution)
- ✅ Use Cases/Services publish domain events (business state changes)
- ❌ Controllers NEVER publish domain events

**Example:**

```typescript
// ✅ GOOD - Use Case publishes domain event
class StartGridUseCase {
    async execute(grid: Grid) {
        await this.placeOrders(grid);
        this.eventBus.publish(new GridStartedEvent(grid)); // Domain event
        return grid;
    }
}

// ✅ GOOD - Controller publishes notification event
class GridController {
    async createGrid(command: CreateGridCommand) {
        const result = await this.useCase.execute(command);
        this.eventBus.publish(new GridCreatedSuccessEvent(result)); // Notification
    }
}
```

### Type Separation

- ❌ NEVER export types from use-case files (except the use-case class itself)
- ❌ NEVER export types from service files (except the service class itself)
- ✅ Create separate files for exported types the same directory

**Why?**

- Types may be used by multiple consumers (controllers, other services, tests)
- Importing from service file creates unnecessary dependency on service implementation
- Easier to find and manage types when they're in dedicated files

**Example:**

```
core/services/
  ├── capital-calculator.service.ts  (only exports CapitalCalculatorService)
  └── types/
      ├── capital-distribution.ts
      └── calculate-params.ts
```

**Bad:**

```typescript
// ❌ capital-calculator.service.ts
export interface CapitalDistribution { ... }
export class CapitalCalculatorService { ... }
```

**Good:**

```typescript
// ✅ core/services/types/capital-distribution.ts
export interface CapitalDistribution { ... }

// ✅ capital-calculator.service.ts
import { CapitalDistribution } from './types/capital-distribution';
export class CapitalCalculatorService { ... }
```

---

## 🧪 Testing Strategy

### Test Framework: Vitest

**We use Vitest (not Jest) for all tests**

- ✅ Import test functions from `vitest`: `import { describe, it, expect, vi, beforeEach } from 'vitest'`
- ✅ Use `vi.fn()` for mocks (not `jest.fn()`)
- ✅ Use `vi.mock()` for module mocking (not `jest.mock()`)
- ✅ Compatible with `@nestjs/testing` for NestJS services
- ❌ NEVER use global `describe`, `it`, `expect` (always import from 'vitest')

**Example:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';

describe('MyService', () => {
    let service: MyService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [MyService],
        }).compile();

        service = module.get<MyService>(MyService);
    });

    it('should work', () => {
        expect(service.doSomething()).toBe(true);
    });
});
```

### Test Types by Layer

**Core Layer** (`core/use-cases/`, `core/services/`, `core/domain/`)

- ✅ Write **Unit Tests**
- Test business logic in isolation
- Mock all external dependencies (repositories, adapters, other services)
- Focus on logic correctness, edge cases, and domain rules

**Controllers Layer** (`controllers/`)

- ✅ Write **Integration Tests**
- Test interaction with use cases and event bus
- Verify command handling and event publishing
- Mock external systems only (DB, APIs)

**Secondary Layer** (`secondary/`)

- ✅ Write **Integration Tests**
- Test real interaction with external systems
- Verify adapters work with actual APIs/databases
- May use test containers or test environments

**Rules:**

- ❌ NEVER write integration tests for core layer (use unit tests)
- ❌ NEVER write unit tests for controllers/secondary (use integration tests)
- ✅ Keep unit tests fast and isolated
- ✅ Integration tests can be slower but must be reliable

**Repository Implementation Rules** (`secondary/repository/`)

- ✅ Implement ONLY methods that are actually used in the codebase
- ✅ Write integration tests using Testcontainers for each implemented method
- ❌ NEVER implement methods "just in case" or for future use
- ❌ NEVER leave repository methods without integration tests
- ✅ Use `DatabaseTestHelper` from `@infra/database/database-test-helper` for tests
- ✅ Each test should verify database operations with real PostgreSQL container

**Example Structure:**

```
src/components/trading/
  ├── core/
  │   ├── use-cases/
  │   │   └── create-grid.use-case.spec.ts     (unit test)
  │   └── services/
  │       └── capital-calculator.service.spec.ts (unit test)
  ├── controllers/
  │   └── grid.controller.integration.spec.ts   (integration test)
  └── secondary/
      └── hyperliquid.adapter.integration.spec.ts (integration test)
```

---

## 📄 Documentation Rules

### ARCHITECTURE.md Content Rules

**ARCHITECTURE.md must contain ONLY high-level architectural decisions**

- ✅ Architectural patterns (Hexagonal, DDD, Event-driven)
- ✅ System components and their interactions
- ✅ Critical design decisions and rationale
- ✅ Data flow and communication patterns
- ✅ High-level structure (workers, adapters, use cases)
- ❌ NEVER add code examples to ARCHITECTURE.md
- ❌ NEVER add SQL schemas or database queries
- ❌ NEVER add configuration file examples
- ❌ NEVER add implementation details or specific functions
- ❌ NEVER add API request/response examples

**Keep ARCHITECTURE.md concise and focused on WHY decisions were made, not HOW they are implemented**

### Class Documentation Rules

- IF class has JSDoc documentation → THEN update it when changing class signature or behavior
- IF parameter renamed → THEN update @param documentation
- IF method signature changed → THEN update method documentation
- IF class behavior changed → THEN update class description
- IF code examples in documentation → THEN update them to reflect changes

**Documentation must stay synchronized with code**

---

## 🚫 Protected Files

### NEVER Delete These Files

The following documentation files are **CRITICAL** and must **NEVER** be deleted:

- `AGENTS.md` - AI agent rules and guidelines
- `ARCHITECTURE.md` - System architecture documentation
- `QUICKSTART.md` - Quick start guide for users
- `README.md` - Main project documentation
- `SPOT_GRID_TRADING_ALGORITHM.md` - Trading algorithm explanation

**Rules:**

- ❌ NEVER delete or remove these files
- ❌ NEVER suggest deleting these files
- ✅ Always ask user before modifying documentation files
- ✅ Only edit documentation when explicitly requested
