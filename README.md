# Hyperliquid Grid Bot

Automated SPOT grid trading bot for Hyperliquid with Clean Architecture.

**📊 SPOT Trading** - Physical tokens, zero liquidation risk  
**🤖 Telegram Only** - Full control via mobile  
**🐳 Docker Ready** - Deploy in minutes

---

## 🚀 Quick Links

- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 5 minutes
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - How the bot works
- **[SPOT_GRID_TRADING_ALGORITHM.md](SPOT_GRID_TRADING_ALGORITHM.md)** - Trading strategy explained
- **[AGENTS.md](AGENTS.md)** - Rules for AI agents

---

## 🎯 What Is This?

Grid trading bot that:

- Places buy orders below current price
- Places sell orders above current price
- Automatically refills when orders execute
- Trails up in bull markets to lock profits
- Operates autonomously 24/7

**Profit from volatility, not direction.**

---

## ⚡ Quick Start

### Docker (Production):

```bash
cp .env.docker.example .env
nano .env  # Configure
./deploy.sh
```

### Local (Development):

```bash
pnpm install
docker-compose up -d postgres redis
pnpm db:migrate
pnpm start:dev
```

See [QUICKSTART.md](QUICKSTART.md) for detailed instructions.

---

## 🤖 Usage

Control everything via Telegram:

- `/grid BTC 45000 55000` - Create grid
- `/info` - Check position & P&L
- `/status` - Grid health
- `/stop` - Stop grid

See [ARCHITECTURE.md](ARCHITECTURE.md#user-interaction) for complete command reference.

---

## 🛡️ Why SPOT?

| SPOT (This Bot)    | Perpetuals       |
| ------------------ | ---------------- |
| ✅ No liquidation  | ❌ Can liquidate |
| ✅ No funding fees | ❌ Hourly fees   |
| ✅ Own tokens      | ❌ Just contract |
| ⭐⭐⭐⭐⭐ Safe    | ⭐⭐⭐ Risky     |

See [SPOT_GRID_TRADING_ALGORITHM.md](SPOT_GRID_TRADING_ALGORITHM.md#spot-vs-perpetuals) for comparison.

---

## 🏗️ Architecture

- **Clean Architecture** - Independent components
- **Event-Driven** - Components communicate via events
- **3 Workers** - Price caching, Grid monitoring, Order fills
- **Simple Domain** - No complex patterns

See [ARCHITECTURE.md](ARCHITECTURE.md) for technical details.

---

## 📚 Documentation

| Document                                                         | Purpose                 |
| ---------------------------------------------------------------- | ----------------------- |
| [QUICKSTART.md](QUICKSTART.md)                                   | Installation & setup    |
| [ARCHITECTURE.md](ARCHITECTURE.md)                               | System design & workers |
| [SPOT_GRID_TRADING_ALGORITHM.md](SPOT_GRID_TRADING_ALGORITHM.md) | Trading strategy        |
| [VPS_DEPLOY.md](VPS_DEPLOY.md)                                   | Production deployment   |
| [AGENTS.md](AGENTS.md)                                           | AI development rules    |

---

## 🔧 Tech Stack

- NestJS 10 + TypeScript 5
- PostgreSQL 16 + Drizzle ORM
- Redis 7
- viem 2 (blockchain)
- telegraf 4 (Telegram)
- Docker

---

## ⚠️ Disclaimer

Educational purposes only. Trading involves risk of loss.

**Test on testnet first. Start with small amounts. Never risk more than you can afford to lose.**

---

## 📝 License

MIT
