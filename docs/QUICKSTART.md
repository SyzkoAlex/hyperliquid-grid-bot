# Quick Start

## Prerequisites

- **Node.js 20+** and **pnpm 8+**
- **Docker** (for Postgres + Redis)
- A **Hyperliquid testnet wallet** — create one at [app.hyperliquid-testnet.xyz](https://app.hyperliquid-testnet.xyz)
- A **Telegram bot token** — create a bot via [@BotFather](https://t.me/BotFather)
- Your **Telegram numeric user ID** — get it from [@userinfobot](https://t.me/userinfobot)

---

## 1. Clone and install

```bash
git clone https://github.com/SyzkoAlex/hyperliquid-grid-bot.git
cd hyperliquid-grid-bot
pnpm install
```

---

## 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather (e.g. `1234567890:AAFabc...`) |
| `TELEGRAM_ALLOWED_USER_ID` | Your numeric Telegram user ID — restricts the bot to you only (strongly recommended) |
| `HYPERLIQUID_AGENT_KEY_ENCRYPTION_KEY` | 64-character hex string — generate with `openssl rand -hex 32` |
| `DATABASE_PASSWORD` | Postgres password — must match `docker-compose.yml` |

All other variables have sensible defaults (testnet, local Postgres/Redis).

---

## 3. Start infrastructure

```bash
docker compose up -d
```

This starts Postgres 16 and Redis 7 using the settings in `docker-compose.yml`.

Verify they are running:

```bash
docker compose ps
```

---

## 4. Run database migrations

```bash
pnpm db:migrate
```

This applies all schema migrations in `src/infra/database/migrations/`.

---

## 5. Start the bot

**Development** (hot-reload):

```bash
pnpm start:dev
```

**Production** (compiled):

```bash
pnpm build && pnpm start
```

The bot exposes a health endpoint at `http://localhost:3000/health/live`.

---

## 6. Create your first grid

1. Open Telegram and start a conversation with your bot.
2. Send `/start` — the bot registers your account and shows the main menu.
3. Press **Create Grid** (or send `/grid`) and follow the wizard:
   - Choose a token (e.g. `HYPE`)
   - Set a lower and upper price bound
   - Set the number of grid levels
   - Enter the capital to deploy
   - Review the summary and confirm
4. The bot places orders on Hyperliquid and begins managing the grid automatically.

For strategy details see [docs/SPOT_GRID_TRADING_ALGORITHM.md](SPOT_GRID_TRADING_ALGORITHM.md).
For Telegram bot internals see [docs/TELEGRAM_BOT_GUIDE.md](TELEGRAM_BOT_GUIDE.md).

---

## Testnet vs Mainnet

The default configuration targets **testnet** (`HYPERLIQUID_API_URL=https://api.hyperliquid-testnet.xyz`, `HYPERLIQUID_TESTNET=true`).

To switch to mainnet, update `.env`:

```bash
HYPERLIQUID_API_URL=https://api.hyperliquid.xyz
HYPERLIQUID_TESTNET=false
```

**Always test thoroughly on testnet before deploying real capital.**

---

## Safety

- **`TELEGRAM_ALLOWED_USER_ID` is optional but strongly recommended.** Without it, any Telegram user who discovers your bot can issue commands.
- **Agent wallets cannot withdraw funds.** The bot uses Hyperliquid agent wallets, which can only place and cancel orders on the linked main account. A full database + encryption-key compromise cannot drain your main account. See [SECURITY.md](../SECURITY.md) for the full threat model.

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Insufficient spot balance` | Prior grid orders still open | Stop the conflicting grid or wait for orders to clear |
| `DB connection refused` | Postgres not running | Run `docker compose ps`; check `DATABASE_*` env vars match `docker-compose.yml` |
| `Encryption key missing` | `HYPERLIQUID_AGENT_KEY_ENCRYPTION_KEY` not set | Generate with `openssl rand -hex 32` and add to `.env` |
| `Weak/placeholder encryption key` | Key is too short or all-zeros | Generate a proper 64-char hex key: `openssl rand -hex 32` |
| Bot does not respond | Wrong `TELEGRAM_ALLOWED_USER_ID` | Verify your Telegram ID with @userinfobot |
