# AI Agent Guidelines

## ⚠️ MANDATORY: Run QA Check After Changes

```bash
pnpm qa:check
```

This runs: typecheck → lint → format:check → build → test

**Do NOT commit**

## Git Commits

- When writing a commit message — do NOT add `Co-Authored-By` or any agent/AI attribution

---

## Code Style

→ See **[docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md)**

Covers: minimalism, file organization, TypeScript types, naming, comments, result objects, class design, config access, logging, type separation.

---

## Architecture

→ See **[docs/HEXAGONAL_ARCHITECTURE.md](docs/HEXAGONAL_ARCHITECTURE.md)**

Covers: hexagonal architecture, directory structure, component independence, call chain (Controllers → Use Cases → Services → Adapters), event publishing rules, file/class naming, dependency direction.

**Key rules:**

- Controllers call Use Cases ONLY
- Use Cases call Services (core or secondary)
- Components NEVER import each other's internals — sync calls via consumer-owned ports, async notifications via event bus
- Domain events published by Use Cases/Services; notification events by Controllers

---

## Telegram Bot

→ See **[docs/TELEGRAM_BOT_GUIDE.md](docs/TELEGRAM_BOT_GUIDE.md)**

Covers: handlers, scenes (wizard pattern), actions, keyboards, messages, middleware, registration flow, event-driven notifications.

**Key rules:**

- Handlers implement `Handler` interface with `register()` method
- Action handlers always call `ctx.answerCbQuery()` first
- Scenes use `WizardStep` interface + `WizardNavigator` for step transitions
- Scene actions prefixed with `{scene_name}:` to avoid collisions
- Message text lives in `core/domain/models/messages/` — handlers only call them
- Parse mode: always HTML

---

## 🧪 Testing Strategy

### Framework: Vitest

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

- Use `vi.fn()` / `vi.mock()` — never `jest.*`
- Never use globals — always import from `'vitest'`

### Test Types by Layer

| Layer                                        | Test type                                          |
| -------------------------------------------- | -------------------------------------------------- |
| `domain/services/`, `application/use-cases/` | Unit tests — mock all deps via port interfaces     |
| `infra/adapters/inbound/`                    | Integration tests — mock only external systems     |
| `infra/adapters/outbound/`                   | Integration tests — real DB/API via Testcontainers |

**Rules:**

- Domain/application layer → unit tests only; inject mocked port interfaces
- Inbound adapters → integration tests — mock use cases and external triggers
- Outbound adapters → integration tests — real DB/API; each adapter method needs a test
- Use `DatabaseTestHelper` from `@infra/database/database-test-helper`

---

## 🚫 Protected Files — NEVER Delete

- `AGENTS.md`
- `README.md`
- `docs/*.md`

❌ Never delete or suggest deleting these files
✅ Only edit documentation when explicitly requested
