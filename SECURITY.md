# Security Policy

## Threat model

### Load-bearing safety property

The bot uses **Hyperliquid agent wallets**, which by design **cannot withdraw funds**. Agent keys can only place and cancel spot orders on the linked main account. Even a full database + encryption-key compromise cannot drain a user's main account.

- `accountAddress` (main wallet) — stored in plaintext; this is a public blockchain address.
- `agentPrivateKey` — generated locally via `viem.generatePrivateKey()`, immediately encrypted with **AES-256-GCM** (random 12-byte IV, 16-byte auth tag) before persistence. Stored in the database as `agent_private_key_encrypted`. Never logged, never serialised to events.
- The encryption master key is `HYPERLIQUID_AGENT_KEY_ENCRYPTION_KEY` (64 hex chars / 32 bytes). It is provided via environment variable and lives on the same host as the database — host compromise reveals all agent keys (known limitation; mitigated by the withdrawal-restriction property above).

### Single-user lockdown

`TELEGRAM_ALLOWED_USER_ID` restricts the bot to one Telegram user. When set, every other Telegram chat is silently rejected by `auth.middleware.ts`. It is optional but **strongly recommended** for self-hosted deployments.

---

## What is in scope

Vulnerabilities that allow:

- Bypassing the `TELEGRAM_ALLOWED_USER_ID` authentication lockdown.
- Decrypting stored agent private keys without the `HYPERLIQUID_AGENT_KEY_ENCRYPTION_KEY` master key.
- Placing or cancelling orders on behalf of another user.
- Remote code execution, SQL injection, or server-side request forgery in the bot process.

---

## What is out of scope

- Financial losses from market movement, slippage, exchange downtime, or user-supplied bad grid parameters.
- Vulnerabilities requiring physical or root access to the host server (the encryption key lives alongside the encrypted data — documented known limitation).
- Bugs in the Hyperliquid exchange API or Telegram API.
- Issues only reproducible on unsupported (non-latest) versions.

---

## Reporting a vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Contact: `<security contact email — fill in before publishing>`

If you prefer encrypted communication: `<optional PGP key id>`

Expected response times:

- **7 days** — acknowledgement of your report.
- **30 days** — fix or mitigation plan, or a clear explanation of why the report is out of scope.

We follow **coordinated disclosure**: details are published only after a fix is released or after the 30-day window if no fix is feasible.

---

## Key rotation procedure

If `HYPERLIQUID_AGENT_KEY_ENCRYPTION_KEY` is suspected to be leaked:

1. **Stop the bot** immediately.
2. For each registered user, revoke the agent wallet:
   - In the Hyperliquid UI: go to **Settings → API Wallets** and revoke the agent.
   - Or use the bot's `/disconnect` command if the bot is still accessible.
3. Generate a new encryption key:
   ```bash
   openssl rand -hex 32
   ```
4. Update `HYPERLIQUID_AGENT_KEY_ENCRYPTION_KEY` in `.env` with the new key.
5. Restart the bot.
6. Each user runs `/connect` again to issue a new agent key encrypted with the new master key.

---

## Supported versions

Only the **latest tagged release** receives security fixes.

---

## Disclosure policy

We follow coordinated disclosure. Vulnerability details will be published in the GitHub Security Advisories tab after a fix is released, crediting the reporter (unless anonymity is requested).
