# KrockSide

React + TypeScript chess multiplayer frontend. Backend: Hibrygame Orchestrator (ASP.NET Core 8,
SignalR hub `/chesshub` + REST).

> **Canonical instructions live in [`AGENTS.md`](../AGENTS.md).** Read it before any task — it
> defines the mandatory reading order, the non-negotiable conventions and the critical areas.
> This file is a quick reference only; where the two differ, `AGENTS.md` wins.

> **Read first:**
> - [AGENTS.md](../AGENTS.md) — canonical instructions for agents
> - [.specify/memory/constitution.md](../.specify/memory/constitution.md) — 7 principles (I and II are non-negotiable)
> - [.agents/skills/](../.agents/skills/) — domain truth, loaded on demand; **precedes patterns inferred from code**
> - [.agents/maps/functional-map.md](../.agents/maps/functional-map.md) — the 4 contexts
> - [docs/guia-do-desenvolvedor.md](../docs/guia-do-desenvolvedor.md) — **start here if you are new**: task recipes, repo pitfalls, where not to touch
> - [docs/debito-tecnico.md](../docs/debito-tecnico.md) — **read always**: this front-end has confirmed divergences against the running backend
> - [README.md](../README.md) — setup, scripts, hub contracts
> - [BACKEND_CHANGES.md](../BACKEND_CHANGES.md) — what the backend must change (partly outdated, see DT-05)

## Current state (verified 2026-08-03)

The game **works end to end**: login, lobby, joining a room, moving, checkmate. Player colour comes
from `JoinRoom` and is stored in `src/service/gameSession.ts`; the board is flipped for Black. Those
were DT-01 and DT-09 and both are **resolved**.

Still divergent from the backend, neither blocking play: the sign-up payload (DT-03) and the claims
declared in `DecodedToken` (DT-04). `docs/debito-tecnico.md` is the live list — trust it over any
summary, including this one.

## Stack

- **Framework:** React 18 + TypeScript 5.9
- **Build:** **Vite 7** (`vite.config.ts`), port pinned to 3000 — CRA/`react-scripts` was removed
  in 2026-08-01
- **Real-time:** `@microsoft/signalr` 8 behind `HubProvider` / `useHubConnection`
- **HTTP:** `axios` 1.6 with an `Authorization` interceptor in `src/service/Api.ts`
- **Routing:** `react-router-dom` 6
- **State:** `useState` + `useContext` — no Redux, no React Query
- **Styling:** plain CSS per component in `src/styles/`, plus `tokens.css`
- **Tests:** **Vitest 3** + RTL + `axios-mock-adapter`, **MSW 2** (`http`/`HttpResponse`), Playwright
- **Lint:** own **ESLint 9** flat config (`eslint.config.js`) with `typescript-eslint` +
  `eslint-plugin-react-hooks`; `npm run lint` uses `--max-warnings 0`. Still no formatter (DT-11)

## Run

```bash
cp .env.example .env
npm install
npm run dev                        # http://localhost:3000 (`npm start` is an alias)
npm test                           # Vitest SINGLE RUN (not watch — the opposite of CRA)
npm run test:watch                 # Vitest watch
npm run test:ci                    # single run + coverage + floors
npm run lint                       # ESLint, --max-warnings 0
npm run typecheck                  # tsc --noEmit
npm run build                      # tsc --noEmit && vite build
npx playwright install chromium    # once
npm run test:e2e                   # Playwright (boots the dev server itself)
```

`VITE_API_BASE_URL` (default `https://localhost:5001/`) and `VITE_HUB_URL` (default
`https://localhost:5001/chesshub`), read via `import.meta.env`. **The prefix is `VITE_`** — Vite only
exposes those; the old `REACT_APP_*` names have no effect. Restart the dev server after editing
`.env`. Accept the backend's dev certificate in the browser first, or the hub handshake fails without
a clear message.

## Layout

```
src/
  components/   App, Login, ChessLobby, ChessBoard, ChessSquare, ChessPiece (+ *.test.tsx alongside)
  hooks/        useAuth, useHubConnection (context + provider), useChessGame, useChessLobby
  service/      Api.ts (axios + token storage), userApi.ts (REST), gameSession.ts (colour/name per room)
  types/        auth.ts, chess.ts (backend DTOs + coordinate helpers)
  mocks/        MSW 2 handlers/server/browser
  test-utils/   hub.tsx — createFakeHub + HubTestProvider
  integration/  MSW-backed flow tests
  styles/       one CSS file per component + tokens.css
  setupTests.ts Vitest bootstrap (jest-dom, MSW server)
  index.tsx     entry point: HubProvider above Router
tests-e2e/      Playwright specs
public/         piece images ({color}-{type}.png)
index.html      Vite entry — at the REPO ROOT, not in public/
```

There is no `src/utils/`: CRA's `reportWebVitals` went out with `react-scripts`.

Layer flow: `components → hooks → service → types`. A component never imports `axios` or
`@microsoft/signalr`; `src/service/Api.ts` is the only owner of token storage.

## Non-negotiables (summary — full text in AGENTS.md)

1. **The server is the authority.** No optimistic board updates, no chess rules in the client, the
   player colour comes from `JoinRoom`/`PlayerJoined` — never from a JWT claim.
2. **The contract is typed in `src/types/`** and confirmed against the backend's
   `docs/FRONTEND_CHANGES.md` before implementing. Changes go to `BACKEND_CHANGES.md`.
3. Coordinates crossing the wire are algebraic (`"e2"`); `row`/`column` are grid layout only, via
   the helpers in `src/types/chess.ts` (`column` is **inverted** relative to `rank`).
4. Credentials never in a URL (the SignalR handshake `accessTokenFactory` is the only exception),
   never in logs; token storage is keyed per `userId`.
5. Stable test selectors (`data-testid`, `role`, `label`, `alt`) — never CSS classes.

## Agent harness

```
AGENTS.md              Canonical instructions — read first, wins over this file
CLAUDE.md              Pointer + Spec Kit plan block (machine-managed, do not hand-edit)
.specify/              Spec Kit: constitution, templates, PowerShell scripts, git extension
.agents/skills/        7 project skills + 6 authoring meta-skills
.agents/maps/          functional-map.md — the 4 contexts and their dependencies
.agents/context/       discovery-answers.md — constraints, divergences, pending decisions
.claude/agents/        8 subagents
docs/decisions/        ADRs, immutable once created
```

Subagents: `krockside-react-engineer` (surgical implementation, plan before code), `code-reviewer`,
`unit-test-writer`, `regression-checker`, `spec-reviewer`, `doc-generator`, `spec-feedback`,
`feature-orchestrator` (chains the others).

Spec Kit skills: `speckit-specify`, `speckit-clarify`, `speckit-plan`, `speckit-tasks`,
`speckit-analyze`, `speckit-checklist`, `speckit-implement`, `speckit-constitution`,
`speckit-taskstoissues`, plus the git extension. Scripts are PowerShell and require a `NNN-slug`
branch — they fail on `main` by design.

## Environment caveat — `npm` fails with EPERM, and here is the workaround

The `npm` on `PATH` resolves through an nvm4windows symlink pointing at another user's profile and
throws `EPERM: operation not permitted, lstat 'C:\Users\dgs-admin\AppData'`. `node` itself is fine;
only the `npm-cli.js` resolution breaks. Two verified ways around it:

```powershell
# 1. Prefix the Program Files Node onto the session PATH (preferred)
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm run test:ci

# 2. Call the local tools directly, no npm
node .\node_modules\typescript\bin\tsc --noEmit
node .\node_modules\eslint\bin\eslint.js . --max-warnings 0
node .\node_modules\vitest\vitest.mjs run
```

The suite **has** been run: **10 files, 72 tests passing**, `tsc --noEmit` clean, `eslint
--max-warnings 0` clean (2026-08-03). Any harness document claiming the suite could not be executed
predates this workaround.

## CI gates

`.github/workflows/ci.yml` runs `npm ci`, `npx tsc --noEmit`, `npm run test:ci` and `npm run build`
on push and PR to `main`. `codeql.yml` runs the security scan.

Before merge:
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean (`--max-warnings 0`)
- [ ] `npm run test:ci` green, coverage floors met
- [ ] `npm run build` succeeds
- [ ] Constitution respected — Principles I (server authority) and II (explicit contract)
- [ ] If a backend contract changed: `BACKEND_CHANGES.md` updated
- [ ] If debt was created or resolved: `docs/debito-tecnico.md` updated
- [ ] If a domain rule changed: the matching `.agents/skills/{skill}/SKILL.md` updated
- [ ] If structure or convention changed: `AGENTS.md` + `README.md` + this file updated
