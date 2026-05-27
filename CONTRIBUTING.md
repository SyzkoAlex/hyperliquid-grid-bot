# Contributing

Thank you for considering a contribution to Hyperliquid Grid Bot.

---

## Development setup

Requirements: Node.js 20+, pnpm 8+, Docker.

Full setup instructions: [docs/QUICKSTART.md](docs/QUICKSTART.md).

---

## Branch model

`main` is the only long-lived branch. Work in short-lived feature branches and open a pull request targeting `main`.

Branch naming: `feature/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`.

---

## Required checks

Every PR must pass:

```bash
pnpm qa:check
```

This runs: typecheck → lint → format:check → build → unit tests → `pnpm audit --audit-level high`.

The CI workflow at `.github/workflows/qa.yml` enforces this on every push. PRs that fail CI are not merged.

---

## Code style

See [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) for the full rules. Key points:

- Minimalism — no unnecessary abstraction, no defensive padding.
- TypeScript strict — no `@ts-ignore`, no untyped `any` outside test files.
- Structured logging via the injected `Logger` port — never `console.*` in production code.
- Result objects over exceptions for expected failure paths.

---

## Architecture

See [docs/HEXAGONAL_ARCHITECTURE.md](docs/HEXAGONAL_ARCHITECTURE.md) for the full ports-and-adapters guide. Key rules:

- **Dependency direction:** Controllers → Use Cases → Services → Adapters. Never the reverse.
- **No cross-component imports.** Components (`trading`, `telegram`, `grids`) communicate only through the event bus (async) or via consumer-owned port adapters (sync).
- New components follow the same `api/`, `core/domain/`, `core/application/`, `adapters/inbound/`, `adapters/outbound/` layout.

---

## Tests

Framework: **Vitest** — never Jest. Always import from `'vitest'`.

| Layer | Test type |
|---|---|
| Domain services, application use-cases | Unit tests — mock all deps via port interfaces |
| Inbound adapters | Integration tests — mock use cases and external triggers |
| Outbound adapters (DB, Redis, HTTP) | Integration tests — real infra via Testcontainers |

Run unit tests:

```bash
pnpm test:unit
```

Run integration tests (requires Docker):

```bash
pnpm test:integration
```

---

## Commit and PR etiquette

- Commit messages follow **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`.
- Squash-merge preferred; the PR title becomes the merge-commit message.
- Do **not** add `Co-Authored-By` or AI-attribution lines to commit messages.
- Each commit must leave the codebase in a passing state.

---

## Reporting issues

- **Bugs:** open a GitHub Issue with: steps to reproduce, expected vs actual behaviour, relevant bot logs (redact any secrets before pasting).
- **Security vulnerabilities:** do **not** open a public issue — see [SECURITY.md](SECURITY.md) for the responsible-disclosure process.
- **Feature requests:** open a GitHub Discussion or Issue; reference relevant sections of `docs/TODO.md` if the idea already exists there.
