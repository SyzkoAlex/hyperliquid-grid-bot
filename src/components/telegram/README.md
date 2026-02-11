# Telegram Component

## Architectural Decision: Telegram as Core Feature

### Why Telegram is NOT in Secondary Layer

Unlike other components in this project that follow strict Hexagonal Architecture, the **Telegram component treats Telegram as a core feature**, not as an external dependency.

**Rationale:**

1. **Telegram IS the primary interface** for this component
   - This is a Telegram bot component, not a business logic component that happens to use Telegram
   - Telegram is not interchangeable - we won't swap it for Slack, Discord, or HTTP API
   - The entire component's purpose is to provide Telegram-based trading interface

2. **Abstraction creates unnecessary complexity**
   - Interfaces like `TelegramService`, `MessageContext`, `SceneHandler` add layers without value
   - Adapters like `TelegrafSceneAdapter`, `TelegrafWizardContextAdapter` wrap Telegraf for no reason
   - Every interaction requires jumping between `core` → `secondary` → back to `core`
   - This makes the code harder to understand and maintain

3. **Direct Telegraf usage is simpler and clearer**
   - Business logic can work directly with `BotContext` from Telegraf
   - Scene handlers can create and register Telegraf scenes themselves
   - No need for adapter layers that just delegate calls

### Architecture Structure

```
telegram/
├── core/
│   ├── services/
│   │   ├── notification.service.ts
│   │   └── telegram-bot/              ← Telegram bot implementation (core feature!)
│   │       ├── telegram-bot.service.ts
│   │       ├── redis-session-store.ts
│   │       ├── types/
│   │       ├── handlers/              ← Command handlers (business logic)
│   │       └── scenes/                ← Wizard scenes (business logic)
│   ├── domain/                        ← Domain entities
│   └── use-cases/                     ← Use cases
├── controllers/                       ← Entry points (registration only)
│   ├── telegram-commands.controller.ts
│   └── trading-events.controller.ts
└── secondary/
    └── repository/                    ← Database access (truly external)
```

### What Stays in Secondary

Only **truly external systems** remain in `secondary/`:
- **PostgreSQL repositories** - database is an external system that could be swapped
- These ARE proper secondary adapters because we might want to test with in-memory storage

### Key Principles Applied Here

1. **Pragmatism over dogma** - Architecture patterns serve the code, not vice versa
2. **Minimize abstractions** - Only abstract when there's a real need to swap implementations
3. **Code clarity** - Direct dependencies are clearer than unnecessary indirection
4. **YAGNI** - We aren't gonna need to swap Telegram for another bot platform

### Comparison with Other Components

Other components (like `trading`) DO follow Hexagonal Architecture because:
- They integrate with external exchanges (Hyperliquid) that could be swapped
- Business logic is independent of infrastructure
- Multiple adapters might be needed (REST API, WebSocket, mock for testing)

This component is different - **Telegram IS its purpose**, not a replaceable detail.

---

**Note:** This is an intentional architectural decision for THIS component only. Other components in the project still follow Hexagonal Architecture where it makes sense.
