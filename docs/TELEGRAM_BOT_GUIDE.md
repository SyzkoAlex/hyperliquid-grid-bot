# Telegram Bot Guide

Framework: [Telegraf](https://telegraf.js.org/) + NestJS DI

---

## Directory Structure

```
telegram/adapters/inbound/telegram-bot/
├── handlers/                    # Command & action handlers
│   ├── handler.ts               # Handler interface
│   ├── inline-keyboard.ts       # InlineButton[][] → Telegraf markup
│   ├── main-menu.keyboard.ts    # Main menu keyboards (inline + reply)
│   └── {feature}/
│       └── {feature}.handler.ts
├── messages/                    # Adapter-level message builders
│   └── {feature}.message.ts
├── middleware/                   # Bot middleware
│   ├── error-handler.middleware.ts
│   └── callback-dedup.middleware.ts
├── scenes/                      # Multi-step wizards
│   └── {scene-name}/
│       ├── {scene-name}.scene.ts
│       ├── {scene-name}-actions.ts
│       ├── {scene-name}-scene-step.ts
│       ├── {scene-name}-wizard-state.ts
│       ├── {scene-name}-mode.ts         # (optional)
│       ├── steps/
│       │   └── {step-name}.step.ts
│       ├── wizard/
│       │   ├── wizard-step.ts           # Step interface
│       │   ├── step-result.ts
│       │   ├── wizard-navigator.ts
│       │   └── wizard-message-manager.ts
│       └── helpers/                     # (optional)
│           └── {helper-name}.ts
├── types/
│   ├── bot-context.ts           # Extended Telegraf context
│   └── session-data.ts          # Redis session shape
├── redis-session-store.ts
└── telegram-bot.service.ts      # Bot lifecycle + registration API

telegram/core/domain/models/
├── constants/
│   ├── button-labels.constants.ts
│   ├── emoji.constants.ts
│   └── wizard-config.ts
├── formatters/
│   └── price.formatter.ts
├── messages/                    # Domain-level message classes
│   ├── telegram-message.ts      # Abstract base class
│   ├── wizard/                  # Wizard step messages
│   │   └── {step-name}.messages.ts
│   └── {feature}-message.ts
├── inline-button.ts
├── telegram-command.ts          # TelegramCommand, TelegramAction, GridAction
└── telegram-parse-mode.ts
```

---

## Handlers

### Interface

```typescript
export interface Handler {
    register(): void;
}
```

### Creating a Handler

1. Create `handlers/{feature}/{feature}.handler.ts`
2. Implement `Handler`, inject `TelegramBotService`
3. In `register()`, bind commands / actions / hears

```typescript
@Injectable()
export class HelpHandler implements Handler {
    constructor(private readonly telegramBotService: TelegramBotService) {}

    register(): void {
        this.telegramBotService.onCommand(TelegramCommand.Help, (ctx) => this.handle(ctx));
        this.telegramBotService.onAction(TelegramAction.ShowHelp, (ctx) => this.handleAction(ctx));
        this.telegramBotService.onHears('❓ Help', (ctx) => this.handle(ctx));
    }

    private async handle(ctx: BotContext): Promise<void> {
        await ctx.reply(new HelpMessage().toString(), {
            parse_mode: 'HTML',
            ...replyMenuKeyboard(),
        });
    }

    private async handleAction(ctx: BotContext): Promise<void> {
        await ctx.answerCbQuery();
        await ctx.editMessageText(new HelpMessage().toString(), {
            parse_mode: 'HTML',
            ...toInlineKeyboard(backToMenuKeyboard()),
        });
    }
}
```

4. Register in `TelegramCommandsAdapter.registerHandlers()`

### Registration Methods

| Method | Use case |
|--------|----------|
| `onCommand(cmd, handler)` | Slash commands (`/start`, `/help`) |
| `onAction(action, handler)` | Inline button callbacks (string or RegExp) |
| `onHears(text, handler)` | Reply keyboard text matching |

### Handler Rules

- **Command handler** (`handle`) → `ctx.reply()` with reply keyboard
- **Action handler** (`handleAction`) → always call `ctx.answerCbQuery()` first, then `ctx.editMessageText()` to update in-place
- Use case injection: inject use cases directly into handler constructor
- Extract `ctx.match![1]` for dynamic action regex patterns

---

## Actions & Commands

### Static Actions

Define in `telegram-command.ts`:

```typescript
export enum TelegramCommand {
    Start = 'start',
    Help = 'help',
}

export enum TelegramAction {
    MainMenu = 'main:menu',
    ListGrids = 'list:grids',
    CreateGrid = 'create:grid',
}
```

### Dynamic Actions (with parameters)

Use a `const` object with builder functions + regex patterns:

```typescript
export const GridAction = {
    // Builders — create callback data
    view: (id: string) => `view:grid:${id}`,
    stop: (id: string) => `stop:grid:${id}`,

    // Patterns — match incoming callbacks
    VIEW_PATTERN: /^view:grid:([^:]+)$/,
    STOP_PATTERN: /^stop:grid:(.+)$/,
} as const;
```

Register with regex, extract ID from `ctx.match![1]`:

```typescript
this.telegramBotService.onAction(GridAction.VIEW_PATTERN, (ctx) => this.handleView(ctx));

private async handleView(ctx: BotContext): Promise<void> {
    await ctx.answerCbQuery();
    const gridId = ctx.match![1];
    // ...
}
```

### Scene Actions

Scene-scoped actions live in `{scene-name}-actions.ts`:

```typescript
export const CREATE_GRID_ACTIONS = {
    PAIR_PREFIX: 'create_grid:pair:',
    OTHER_PAIR: 'create_grid:other_pair',
    CONFIRM: 'create_grid:confirm',
    BACK: 'create_grid:back',
    CANCEL: 'create_grid:cancel',
} as const;

export const CREATE_GRID_PATTERNS = {
    PAIR: /^create_grid:pair:(.+)$/,
} as const;

export const buildPairAction = (symbol: string): string =>
    `${CREATE_GRID_ACTIONS.PAIR_PREFIX}${symbol}`;
```

**Naming convention:** prefix all scene actions with `{scene_name}:` to avoid collisions.

---

## Keyboards

### Inline Keyboard

Use `InlineButton[][]` (rows of buttons) + `toInlineKeyboard()` helper:

```typescript
const buttons: InlineButton[][] = [
    [
        { text: '📊 Grids', action: TelegramAction.ListGrids },
        { text: '💰 Balance', action: TelegramAction.ShowBalance },
    ],
    [{ text: '❓ Help', action: TelegramAction.ShowHelp }],
];

await ctx.reply(text, { parse_mode: 'HTML', ...toInlineKeyboard(buttons) });
```

Keyboard builder functions return `InlineButton[][]`, not Telegraf markup — the `toInlineKeyboard()` call happens at the usage site.

### Reply Keyboard

Persistent keyboard at the bottom of the chat. Defined in `main-menu.keyboard.ts`:

```typescript
export function replyMenuKeyboard(): ReturnType<typeof Markup.keyboard> {
    return Markup.keyboard([
        ['📊 Grids', '💰 Balance'],
        ['📈 Stats', '➕ Create Grid'],
    ]).resize();
}
```

Reply keyboard text is matched via `onHears()`.

---

## Messages

### Domain Message Classes

Extend `TelegramMessage` for standalone messages (welcome, help, notifications):

```typescript
export abstract class TelegramMessage {
    protected abstract readonly text: string;
    toString(): string { return this.text; }
}

export class WelcomeMessage extends TelegramMessage {
    protected readonly text = `<b>Welcome!</b>\n\nSelect an option below.`;
}
```

Usage: `new WelcomeMessage().toString()`

### Static Message Factories

For wizard step messages and complex formatted messages, use classes with static methods:

```typescript
export class AdvancedUpperMessages {
    static prompt(symbol?: string, currentPrice?: number): string {
        return `Enter upper price for ${symbol}...`;
    }
    static confirmation(price: number): string {
        return `✅ Upper: $${PriceFormatter.format(price)}`;
    }
}
```

### Adapter-Level Messages

Complex messages with multiple render modes live in `messages/`:

```typescript
export class GridListItemMessage {
    static fromCardData(item: GridWithPnl): string { /* card view */ }
    static profitTab(item: GridWithPnl): string { /* detail view */ }
    static ordersTab(item: GridWithPnl): string { /* orders tab */ }
}
```

### Rules

- Parse mode: always `HTML`
- Constants: use `EMOJI.*` for emojis, `BUTTON_LABELS.*` for button text
- Formatting: use `PriceFormatter.format()` for prices
- Message text lives in `core/domain/models/messages/` — handlers only call them

---

## Scenes (Wizard Pattern)

Scenes handle multi-step interactive flows (e.g. grid creation wizard).

### Architecture

```
Scene Handler ─── creates BaseScene, registers actions, routes text input
    ├── WizardNavigator ─── manages step transitions, back/cancel, state
    ├── WizardMessageManager ─── sends/deletes enter & confirmation messages
    └── Steps (WizardStep[]) ─── individual step logic
```

### Creating a Scene

#### 1. Define Steps Enum

```typescript
// {scene-name}-scene-step.ts
export enum SceneStep {
    Pair = 'pair',
    Mode = 'mode',
    Confirm = 'confirm',
}
```

#### 2. Define Wizard State

```typescript
// {scene-name}-wizard-state.ts
export interface CreateGridWizardState {
    symbol?: string;
    mode?: CreateGridMode;
    currentStep?: SceneStep;
    stepHistory?: SceneStep[];
    stepMessages?: Record<string, StepMessages>;
}
```

Add the state field to `SessionData`:

```typescript
export interface SessionData extends Scenes.SceneSession<Scenes.SceneSessionData> {
    createGrid?: CreateGridWizardState;
}
```

#### 3. Define Actions

```typescript
// {scene-name}-actions.ts
export const MY_SCENE_ACTIONS = {
    OPTION_A: 'my_scene:option_a',
    BACK: 'my_scene:back',
    CANCEL: 'my_scene:cancel',
} as const;
```

#### 4. Implement Steps

Each step implements `WizardStep`:

```typescript
export interface WizardStep {
    readonly id: SceneStep;
    enter(ctx: BotContext): Promise<void>;
    rollbackState(ctx: BotContext): void;
    handleTextInput?(ctx: BotContext, text: string): Promise<StepResult>;
}
```

Step returns `StepResult`:

```typescript
export interface StepCompleted {
    nextStep: SceneStep;
    confirmations?: string[];
}
export type StepResult = StepCompleted | null;  // null = stay on current step
```

Example step:

```typescript
@Injectable()
export class AdvancedUpperStep implements WizardStep {
    readonly id = SceneStep.Upper;

    constructor(
        @Inject(TRADING_API_PORT) private readonly tradingApi: TradingApiPort,
        private readonly messageManager: WizardMessageManager,
    ) {}

    async enter(ctx: BotContext): Promise<void> {
        const keyboard: InlineButton[][] = [
            [
                { text: BUTTON_LABELS.BACK, action: CREATE_GRID_ACTIONS.BACK },
                { text: BUTTON_LABELS.CANCEL, action: CREATE_GRID_ACTIONS.CANCEL },
            ],
        ];
        await this.messageManager.sendEnterMessage(ctx, 'Enter upper price:', keyboard);
    }

    async handleTextInput(ctx: BotContext, text: string): Promise<StepResult> {
        const price = parseFloat(text);
        if (isNaN(price) || price <= 0) {
            await this.messageManager.sendEnterMessage(ctx, 'Invalid price');
            return null;
        }
        ctx.session.createGrid!.upperPrice = price;
        return { nextStep: SceneStep.Lower, confirmations: ['✅ Upper: $' + price] };
    }

    rollbackState(ctx: BotContext): void {
        if (ctx.session.createGrid) {
            delete ctx.session.createGrid.upperPrice;
        }
    }
}
```

#### 5. Create Scene Handler

```typescript
@Injectable()
export class CreateGridSceneHandler {
    readonly id = CREATE_GRID_SCENE_ID;

    constructor(
        private readonly navigator: WizardNavigator,
        private readonly messageManager: WizardMessageManager,
        private readonly selectPairStep: SelectPairStep,
        // ... other steps
    ) {
        this.navigator.registerStep(selectPairStep);
        // ... register all steps
    }

    createScene(): Scenes.BaseScene<BotContext> {
        const scene = new Scenes.BaseScene<BotContext>(CREATE_GRID_SCENE_ID);

        scene.enter((ctx) => this.navigator.start(ctx));

        // Register action handlers
        scene.action(PATTERNS.PAIR, (ctx) => this.handlePairAction(ctx));
        scene.action(ACTIONS.BACK, (ctx) => this.handleBackAction(ctx));
        scene.action(ACTIONS.CANCEL, (ctx) => this.handleCancelAction(ctx));

        // Text input routing
        scene.on('text', (ctx) => this.handleTextInput(ctx));

        return scene;
    }
}
```

#### 6. Register Scene

In `TelegramCommandsAdapter`:

```typescript
private registerScenes() {
    this.telegramBotService.registerScene(this.createGridSceneHandler);
}
```

### Wizard Flow

```
scene.enter() → navigator.start() → init state → first step.enter()
    ↓
step.enter() → messageManager.sendEnterMessage() → show prompt + buttons
    ↓
user input (action/text) → step handler → returns StepResult
    ↓
StepResult = null → stay on step (validation error)
StepResult = { nextStep, confirmations } → navigator.completeStep()
    ↓
navigator.completeStep() → delete enter messages → send confirmations
                         → push to stepHistory → enter next step
    ↓
Back → navigator.handleBack() → rollbackState() → re-enter previous step
Cancel → navigator.handleCancel() → deleteAllMessages() → leave scene
```

### Text Input in Scenes

The scene handler routes all text to the current step:

```typescript
scene.on('text', (ctx) => this.handleTextInput(ctx));

private async handleTextInput(ctx: BotContext): Promise<void> {
    const text = ctx.message.text;

    // Exit scene on slash commands or reply keyboard buttons
    if (text.startsWith('/') || isReplyMenuText(text)) {
        await ctx.scene.leave();
        return;
    }

    const step = this.navigator.getStepInstance(this.navigator.getCurrentStep(ctx)!);
    if (!step?.handleTextInput) return;

    const result = await step.handleTextInput(ctx, text);
    if (result) {
        await this.navigator.completeStep(ctx, result);
    }
}
```

### Message Lifecycle

The `WizardMessageManager` tracks message IDs per step to enable clean transitions:

| Message type | Sent when | Deleted when |
|--------------|-----------|--------------|
| Enter message | `step.enter()` | Step completes or Back pressed |
| Confirmation message | Step completes | Back pressed (previous step) |

On Cancel — all messages from all steps are deleted.

---

## Middleware

Middleware order in `TelegramBotService`:

1. **Session** — Redis-backed session hydration
2. **Auth** — chat ID authorization
3. **Error handler** — catches unhandled errors, sends user-friendly reply
4. **Callback dedup** — prevents duplicate button presses (in-flight Set)
5. **Stage** — scene management

---

## Registration Flow

`TelegramCommandsAdapter.onModuleInit()`:

1. `registerScenes()` — register all scene handlers
2. `registerHandlers()` — call `handler.register()` on each handler
3. `telegramBotService.launch()` — start polling

Scenes must be registered **before** handlers, because the Stage middleware
needs to know all scenes at launch time.

---

## Event-Driven Notifications

The `TradingEventsAdapter` subscribes to domain events and calls `NotifyUserUseCase`:

```typescript
this.subscriber.subscribe<SerializableEvent>(
    EventType.OrderOpened,
    async (event) => {
        const typed = this.deserializer.deserialize(event.eventType, event.serialize());
        await this.notifyUser.execute({ event: typed });
    },
);
```

Notification message text is built by `NotificationMessageFactory` in domain layer.

---

## Checklist — Adding a New Feature

### New Command/Action Handler

- [ ] Create `handlers/{feature}/{feature}.handler.ts` implementing `Handler`
- [ ] Add command to `TelegramCommand` or action to `TelegramAction` enum
- [ ] Register in `TelegramCommandsAdapter.registerHandlers()`
- [ ] Create message class in `core/domain/models/messages/`
- [ ] Always `ctx.answerCbQuery()` in action handlers

### New Scene

- [ ] Create directory `scenes/{scene-name}/`
- [ ] Define `SceneStep` enum, wizard state interface, actions constants
- [ ] Implement steps (`WizardStep` interface)
- [ ] Create scene handler with `createScene()` method
- [ ] Add wizard state to `SessionData`
- [ ] Register scene in `TelegramCommandsAdapter.registerScenes()`
- [ ] Reuse `WizardNavigator` and `WizardMessageManager` for step transitions
- [ ] Prefix all scene actions with `{scene_name}:` to avoid collisions

### New Wizard Step

- [ ] Create `steps/{step-name}.step.ts` implementing `WizardStep`
- [ ] Add step to `SceneStep` enum
- [ ] Implement `enter()`, `rollbackState()`, and optionally `handleTextInput()`
- [ ] Return `StepResult` — `null` to stay, `{ nextStep, confirmations }` to proceed
- [ ] Register step in scene handler constructor via `navigator.registerStep()`
- [ ] Add action handlers in `createScene()` if step uses inline buttons
- [ ] Create message class in `core/domain/models/messages/wizard/`
