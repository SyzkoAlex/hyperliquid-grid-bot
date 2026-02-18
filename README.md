# Hyperliquid Grid Bot

Automated SPOT grid trading bot for Hyperliquid with Hexagonal Architecture.

- **SPOT Trading** — physical tokens, zero liquidation risk
- **Telegram** — full control via mobile
- **Docker Ready** — self-hosted deployment

---

## What It Does

Places buy orders below current price and sell orders above it. When an order fills, automatically places the opposite order at the next level. Profits from volatility without predicting direction.

---

## Docs

- [docs/QUICKSTART.md](docs/QUICKSTART.md) — installation & setup
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design
- [docs/HEXAGONAL_ARCHITECTURE.md](docs/HEXAGONAL_ARCHITECTURE.md) — ports & adapters guide
- [docs/SPOT_GRID_TRADING_ALGORITHM.md](docs/SPOT_GRID_TRADING_ALGORITHM.md) — trading strategy
- [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) — code style rules
- [AGENTS.md](AGENTS.md) — AI development rules

---

## Tech Stack

- NestJS 10 + TypeScript 5
- PostgreSQL 16 + Drizzle ORM
- Redis 7
- viem 2 (blockchain)
- telegraf 4 (Telegram)
- Docker

---

## Disclaimer

Educational purposes only. Trading involves risk of loss. Test on testnet first. Never risk more than you can afford to lose.

---

## License

MIT
