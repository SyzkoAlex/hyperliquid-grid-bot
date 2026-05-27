# Hyperliquid Grid Bot

> **⚠️ Unofficial community project.**
> This bot is **not** affiliated with, endorsed by, or officially supported by
> [Hyperliquid](https://hyperliquid.xyz/) or its developers.
> Use it at your own risk.

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
- [SECURITY.md](SECURITY.md) — vulnerability reporting & threat model
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
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

## ⚠️ Safety & Disclaimer

- **Testnet first.** Default config (`HYPERLIQUID_API_URL`) targets testnet. Do not switch to mainnet until you have thoroughly tested on testnet.
- **Agent wallets cannot withdraw.** The bot only places/cancels orders. Even a full DB + key compromise cannot drain your main account. See [SECURITY.md](SECURITY.md).
- **Lock down access.** Set `TELEGRAM_ALLOWED_USER_ID` to your numeric Telegram user ID. Without it, anyone who finds your bot can issue commands.
- **Not financial advice.** This software is provided for educational and experimental purposes only.

<details>
<summary>Full risk &amp; liability disclaimer</summary>

Trading financial instruments, including crypto assets on decentralised exchanges, involves substantial risk of loss. You may lose some or all of your invested capital.

This software is provided **"as is"**, without warranty of any kind, express or implied. The authors and contributors:

- make **no representations** about the accuracy, completeness, or fitness-for-purpose of the software or any strategy it implements;
- are **not responsible** for any financial losses, missed trades, bugs, exchange API changes, network outages, or other adverse outcomes arising from the use of this bot;
- provide **no financial, investment, tax, or legal advice** of any kind.

Past simulated or live results do not guarantee future performance. Grid trading strategies can and do lose money in trending markets. Always understand a strategy fully before deploying real capital.

By using this software you acknowledge that you have read this disclaimer, understand the risks, and accept full responsibility for your trading decisions and any resulting losses.

</details>

---

## Contributing

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: correct a bug
refactor: restructure without behaviour change
docs: documentation only
chore: tooling, deps, config
test: add or update tests
```

Every PR must pass `pnpm qa:check` before merge. See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

---

## Releasing

Releases are cut entirely from GitHub — no local commands needed.

1. Go to **Actions → Release → Run workflow**
2. Choose `patch`, `minor`, or `major`
3. Click **Run workflow**

The action will:
- bump the version in `package.json`
- regenerate `CHANGELOG.md`
- create a git tag and a GitHub Release with auto-generated release notes

---

## License

MIT
