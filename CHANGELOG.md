# Changelog

All notable changes to this project will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-05-27

### Features

- **telegram:** Add persistent menu button via setMyCommands

### Bug Fixes

- **ci:** Construct PR URL from remote.github vars — commit.remote.pr_url does not exist in git-cliff 2.x
- **ci:** Grant pull-requests:read so GITHUB_TOKEN can fetch PR metadata for git-cliff
- **ci:** Pass GITHUB_TOKEN to git-cliff steps, fix deprecated commit.github refs and owner casing

## [1.0.0] — 2026-05-27

Initial public release.

### Added

#### Core trading
- SPOT grid trading on Hyperliquid (testnet + mainnet)
- Automatic buy/sell order placement across configurable price levels
- Order fill detection and opposite-side refill cycle
- Pre-flight capital validation with exchange ceil-rounding parity
- Sell-size buffer to prevent notional-below-minimum rejections
- Harmonic-mean USDC notional distribution for equal per-level spend
- Stop-loss with configurable trigger price and market-sell execution ([docs/STOP_LOSS.md](docs/STOP_LOSS.md))
- Unrealized PnL frozen at stop price for stopped grids
- Grid P&L accounting for initial base-token allocation and entry price

#### Wallet & security
- Per-user agent wallet — generated locally, never touches the main account withdrawal path
- AES-256-GCM encryption of agent private keys with a master env key
- Agent approval expiration detection and re-connection flow

#### Telegram bot
- Full grid management via Telegram: create, stop, list, history, settings
- Single-message state-board wizard (create-grid in one pinned message)
- Reply-menu keyboard on `/start` with context-aware buttons
- Trade notifications with per-user toggle and personal-chat routing
- Per-user timezone support across history, profit tabs, and notifications
- Top tokens by 24 h volume for quick pair selection
- `TELEGRAM_ALLOWED_USER_ID` single-user lockdown

#### Infrastructure
- PostgreSQL 16 + Drizzle ORM with migration runner
- Redis 7 for distributed locking and session storage
- Docker Compose local deployment
- Prometheus metrics with env label on all instruments
- Structured JSON logging via pino; pretty-print in dev
- WebSocket keepalive for Hyperliquid idle-disconnect prevention
- Self-trade prevention recovery with automatic retry
- pg 57P01 (admin shutdown) crash prevention

#### Developer experience
- Hexagonal architecture: three bounded contexts (grids, trading, telegram)
- QA gate: typecheck → lint → format → build → unit tests → audit
- Vitest unit tests; Testcontainers integration tests
- GitHub Actions CI on every push
