# Changelog

All notable changes to this project will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- next-release -->
## [1.1.0] — 2026-05-27

### Bug Fixes

- **ci:** Construct PR URL from remote.github vars — commit.remote.pr_url does not exist in git-cliff 2.x 
- **ci:** Grant pull-requests:read so GITHUB_TOKEN can fetch PR metadata for git-cliff 
- **ci:** Pass GITHUB_TOKEN to git-cliff steps, fix deprecated commit.github refs and owner casing 
- Prevent suggested max from exceeding balance due to per-level ceil rounding 
- Show correct error when base token is locked in orders and surface SL cancel failures 
- Prevent pg 57P01 from crashing the process on PostgreSQL restart 
- Index assetCtxs by u.index, not array position 
- Always send stop-loss alert and show avg fill price 
- Eliminate Telegram 409 race on rolling deployment (#15) ([#15](https://github.com/SyzkoAlex/hyperliquid-grid-bot/pull/15))
- Mirror exchange ceil-rounding in pre-flight balance check, show actual order count 
- Pre-flight base balance check now accounts for sell-size buffer 
- Remove levels count from Range line, show orders only 
- Replace zero-width space with send-and-delete for keyboard flush in /start 
- Correct when timestamps for migrations 0006 and 0007 in journal 
- Replace console calls with structured logger in migrate.ts 
- Remove level numbers from order display, use price-based identification (#8) ([#8](https://github.com/SyzkoAlex/hyperliquid-grid-bot/pull/8))
- Improve insufficient balance error message with actionable suggestions 
- Handle "false" string correctly in all boolean config fields 
- Account for sellSizeBuffer in suggestedMax and extract to domain service 
- Resolve 4 moderate security vulnerabilities and drop unknown Telegram metrics label 
- Enable metrics endpoint by default in config 
- Add WebSocket keepalive to prevent Hyperliquid idle disconnects 
- Disable metrics endpoint by default in config 
- Round minNotional to cents before minimum check to prevent floating-point false rejections 
- Apply sell size buffer and ceil rounding to prevent notional below minimum 
- Apply sell size buffer and ceil rounding to prevent notional below minimum 
- Pin `path-to-regexp` dependency to version `0.1.13` in package.json and pnpm-lock.yaml 
- Show total investment (USDC + base × price) instead of USDC-only portion 
- Reduce lock log verbosity by moving happy path logs to trace level 
- Update Dockerfile to adjust app port and health check URL 
- Adjust Dockerfile to copy migrations to the correct directory 
- Update pnpm install command to ignore scripts during Docker build 
- Address code review issues in distributed-lock feature (#2) ([#2](https://github.com/SyzkoAlex/hyperliquid-grid-bot/pull/2))

### Chore

- Move pino-pretty to devDeps and refactor Dockerfile multi-stage build 

### Features

- **telegram:** Add persistent menu button via setMyCommands 
- Freeze unrealized PnL at stop price for stopped grids (#17) ([#17](https://github.com/SyzkoAlex/hyperliquid-grid-bot/pull/17))
- Route trade notifications to user's personal bot chat (#14) ([#14](https://github.com/SyzkoAlex/hyperliquid-grid-bot/pull/14))
- Show reply menu keyboard on /start when user has active grids 
- Add trade notifications toggle to user settings (#13) ([#13](https://github.com/SyzkoAlex/hyperliquid-grid-bot/pull/13))
- Allow grids, history, help, settings without active account 
- Show reply menu on landing screen, remove connect CTA 
- Wire user timezone through history, profit tabs and notifications (#10) ([#10](https://github.com/SyzkoAlex/hyperliquid-grid-bot/pull/10))
- Account for initial base token allocation in grid P&L calculation 
- Show entry price in grid profit tab 
- Add agent wallet support with per-user Hyperliquid account management (#7) ([#7](https://github.com/SyzkoAlex/hyperliquid-grid-bot/pull/7))
- Add env label to all Prometheus metrics 
- Save creation price on grid and use it for investment display (#5) ([#5](https://github.com/SyzkoAlex/hyperliquid-grid-bot/pull/5))
- Show date and profit per order in history tab 
- Implement harmonic mean for equal USDC notional per sell level 
- Improve Telegram bot shutdown and lock management 
- Handle self-trade prevention for orders with recovery logic 
- Add configuration loading to bootstrap and update app to listen on configured host and port 
- Add configuration loading to bootstrap and update app to listen on configured host and port 
- Add database migration script and update Docker build step 
- Add telegram component with grid management and hexagonal architecture refactor (#1) ([#1](https://github.com/SyzkoAlex/hyperliquid-grid-bot/pull/1))
- Add migrations for grids and orders tables 

### Refactoring

- Replace multi-message wizard with single state-board message (#19) ([#19](https://github.com/SyzkoAlex/hyperliquid-grid-bot/pull/19))
- Encapsulate sellSizeBuffer inside CapitalCalculatorService 
- Address code-review warnings on top-tokens feature 
- Fix code review warnings in start-screen feature (#12) ([#12](https://github.com/SyzkoAlex/hyperliquid-grid-bot/pull/12))
- Switch sell-level calculation to equal base token distribution 


