# Style Guide

## Minimalism (Critical)

- Write minimum necessary code — no verbosity, no over-engineering
- Don't duplicate existing functionality — reuse or omit
- 3+ similar patterns → extract to one function/module
- Self-evident logic → no comment needed

## File Organization

- One exported class/interface/type per file
- Multiple declarations allowed only if ONE has `export`
- Internal helpers → do NOT export
- Service → dedicated directory (not directly in `services/`):
    ```
    core/services/capital-calculator/
      ├── capital-calculator.service.ts
      ├── capital-calculator.service.spec.ts
      └── types/
          └── calculate-params.ts
    ```

## TypeScript

- Always use explicit types — never `any`
- Use `unknown` + type guard when type is truly unknown
- Use proper union types (`Type | undefined`)

## Naming

- Class: descriptive purpose name
- Method: verb + noun (`saveSecret`, `getSecrets`)
- Boolean: `is/has/can/should` prefix (`isValid`, `hasPermission`)
- Repository single: `findOne*` (`findOneById`)
- Repository multiple: `findMany*` (`findManyActive`)

## Comments

- No comments in code files — use self-documenting names
- If a comment feels needed → refactor to better name instead

## Result Objects

Use class with methods, not interface with direct mutation:

```typescript
export class GridProcessResult {
    constructor(
        public fills = 0,
        public cancellations = 0,
    ) {}
    static empty() {
        return new GridProcessResult();
    }
    incrementFills(v = 1) {
        this.fills += v;
    }
}
```

## Class Design

- Readonly field with no logic → `readonly` public property (not getter)
- Setter with no logic → public property
- Simple field init → constructor parameter properties:
    ```typescript
    class RefillParams {
        constructor(
            readonly side: OrderSide,
            readonly price: number,
        ) {}
    }
    ```

## Configuration

```typescript
class MyService {
    private readonly chatId: number;
    constructor(config: ConfigService<Config, true>) {
        this.chatId = config.get('telegram', { infer: true }).chatId;
    }
}
```

- Never `configService.get<string>('path')` or `.get('path')` without typed Config
- Never `.default()` in zod schemas — values come from `config/config.yml`

## Logging

```typescript
private readonly logger = logger.context(ClassName.name)
// then: this.logger.debug/info/warn/error()
```

- Never `console.log` or direct `logger` calls in classes
- Direct `logger` calls allowed only in bootstrap functions and exception filters

## Type Separation

- Never export types from use-case or service files
- Create separate files for exported types in the same directory
