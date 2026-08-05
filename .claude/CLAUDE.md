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
> - [docs/debito-tecnico.md](../docs/debito-tecnico.md) — **read always**: this front-end has confirmed divergences against the running backend
> - [README.md](../README.md) — setup, scripts, hub contracts
> - [BACKEND_CHANGES.md](../BACKEND_CHANGES.md) — what the backend must change (partly outdated, see DT-05)

## Current state — read before assuming anything works

The board renders and the lobby loads, but **playing is blocked**: `ChessBoard` derives the player
colour from the JWT `role` claim (which carries the permission role, and not even under that key),
so `playerColor` is always `'None'`, `isMyTurn` is always `false`, and all 64 squares are
`disabled`. See DT-01.

Also confirmed broken against the real backend: sign-up, token refresh and joining a room — three
REST routes in `userApi` do not exist server-side (DT-02, DT-03). The suite is green because the
MSW and Playwright mocks mirror the wrong routes. **Fix route and mock in the same commit.**

## Stack

- **Framework:** React 18 + TypeScript 4.9, Create React App (`react-scripts` 5) — no Vite, no Next
- **Real-time:** `@microsoft/signalr` 8 behind `HubProvider` / `useHubConnection`
- **HTTP:** `axios` 1.6 with an `Authorization` interceptor in `src/service/Api.ts`
- **Routing:** `react-router-dom` 6
- **State:** `useState` + `useContext` — no Redux, no React Query
- **Styling:** plain CSS per component in `src/styles/`
- **Tests:** Jest + RTL + `axios-mock-adapter`, MSW **v1**, Playwright
- **Lint:** CRA built-in only — no own ESLint, no Prettier

## Run

```bash
cp .env.example .env
npm install
npm start                          # http://localhost:3000
npm test                           # Jest watch
npm run test:ci                    # single run + coverage
npm run build                      # fails on TypeScript errors — the real type gate
npx tsc --noEmit                   # type check alone
npx playwright install chromium    # once
npm run test:e2e                   # Playwright (boots the dev server itself)
```

`REACT_APP_API_BASE_URL` (default `https://localhost:5001/`) and `REACT_APP_HUB_URL` (default
`https://localhost:5001/chesshub`). CRA reads `REACT_APP_*` at **build time** — restart the dev
server after editing `.env`. Accept the backend's dev certificate in the browser first, or the hub
handshake fails without a clear message.

## Layout

```
src/
  components/   App, Login, ChessLobby, ChessBoard, ChessSquare (+ *.test.tsx alongside)
  hooks/        useAuth, useHubConnection (context + provider), useChessGame
  service/      Api.ts (axios + token storage), userApi.ts (REST calls)
  types/        auth.ts, chess.ts (backend DTOs + coordinate helpers)
  mocks/        MSW handlers/server/browser
  test-utils/   hub.tsx — createFakeHub + HubTestProvider
  integration/  MSW-backed flow tests
  styles/       one CSS file per component
tests-e2e/      Playwright specs
public/         piece images ({color}-{type}.png)
```

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

## Environment caveat

On this machine Node fails with `EPERM: lstat 'C:\Users\dgs-admin\AppData'` when resolving the npm
install directory, so `npm run test:ci`, `npx tsc --noEmit` and `npm run build` could **not** be
run while this harness was written. No test count in any harness document is verified — run the
commands before claiming the suite is green.

## CI gates

`.github/workflows/ci.yml` runs `npm ci`, `npx tsc --noEmit`, `npm run test:ci` and `npm run build`
on push and PR to `main`. It has never run — confirm it is green on the first real execution.

Before merge:
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run test:ci` green
- [ ] `npm run build` succeeds
- [ ] Constitution respected — Principles I (server authority) and II (explicit contract)
- [ ] If a backend contract changed: `BACKEND_CHANGES.md` updated
- [ ] If debt was created or resolved: `docs/debito-tecnico.md` updated
- [ ] If a domain rule changed: the matching `.agents/skills/{skill}/SKILL.md` updated
- [ ] If structure or convention changed: `AGENTS.md` + `README.md` + this file updated
