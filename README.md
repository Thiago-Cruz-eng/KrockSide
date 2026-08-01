# KrockSide

React + TypeScript chess multiplayer frontend. Backend: ASP.NET Core SignalR hub + REST (Hibrygame Orchestrator).

> **Trabalhando neste repositório (pessoa ou agente):** as instruções canônicas estão em
> [`AGENTS.md`](./AGENTS.md), a arquitetura não negociável em
> [`.specify/memory/constitution.md`](./.specify/memory/constitution.md), o conhecimento de domínio
> em [`.agents/skills/`](./.agents/skills/) e as **divergências confirmadas contra o backend** em
> [`docs/debito-tecnico.md`](./docs/debito-tecnico.md) — leia esse último antes de assumir que algo
> funciona ponta a ponta.

## Stack

- React 18 + TypeScript 5.9, empacotado por **Vite 7**
- `@microsoft/signalr` (oficial) via hook `useHubConnection`
- `axios` com `Authorization: Bearer` interceptor
- `react-router-dom` 6
- **Vitest 3** + RTL 16 + MSW 2 (unit & integration)
- Playwright (E2E)
- ESLint 9 (flat config) + typescript-eslint

> O `create-react-app` saiu em 2026-08-01. O relatório da migração e dos bugs corrigidos
> na mesma rodada está em
> [`Hibrygame/docs/refactor-2026-08-01.md`](../Hibrygame/docs/refactor-2026-08-01.md).

## Setup

```bash
cp .env.example .env
npm install
npm start
```

## Variáveis de ambiente

| Var | Default | Descrição |
|-----|---------|-----------|
| `VITE_API_BASE_URL` | `https://localhost:5001/` | REST API |
| `VITE_HUB_URL` | `https://localhost:5001/chesshub` | SignalR hub |

O Vite só expõe ao cliente variáveis com o prefixo `VITE_`. As antigas `REACT_APP_*` eram
substituídas em build pelo `react-scripts` e não têm mais efeito.

## Scripts

| Script | Função |
|--------|--------|
| `npm start` (ou `npm run dev`) | Dev server `localhost:3000` |
| `npm test` | Vitest single-run |
| `npm run test:watch` | Vitest em watch |
| `npm run test:ci` | Vitest com coverage |
| `npm run lint` | ESLint, falha em qualquer aviso |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | `tsc --noEmit` + build de produção em `build/` |
| `npm run test:e2e` | Playwright headless |
| `npm run test:e2e:ui` | Playwright UI mode |

A porta 3000 é fixada em `vite.config.ts` com `strictPort`, e não é preferência: o CORS do
backend libera exatamente `http://localhost:3000` e o Playwright aponta para lá.

## Arquitetura

```
src/
  components/      App, Login, ChessLobby, ChessBoard, ChessSquare
  hooks/           useAuth, useHubConnection, useChessGame
  service/         Api, userApi
  types/           auth.ts, chess.ts (SquareDto, BoardSnapshot, ...)
  mocks/           MSW handlers
  test-utils/      FakeHub
  integration/     Tests integration via MSW
  styles/
tests-e2e/         Playwright specs
playwright.config.ts
```

### Contratos hub (Hibrygame)

Invocados pelo cliente:
- `CreateRoom(name) → CreateRoomResponse`
- `JoinRoom(player, name) → JoinRoomResponse` (inclui `color`)
- `GetAvailableRooms() → string[]`
- `GetPlayersInEachRoom() → Record<room, players[]>`
- `GetPlayersInRoom(name) → number`
- `StartGame(name) → StartGameResponse` (snapshot)
- `GetBoardSnapshot(name) → BoardSnapshot`
- `GetPossibleMoves(name, from) → PossibleMovesResponse` (algébrico, ex: `"e2"`)
- `MakeMove(name, from, to) → MakeMoveResponse` (com turn enforcement no server)
- `LeaveRoom(name)`

Eventos do servidor:
- `GameStarted` — `BoardSnapshot`
- `BoardChanged` — `{ from, to, byColor, nextTurn, snapshot }`
- `PlayerJoined` / `PlayerLeft` — `{ room, players: [{ name, color }] }`
- `RoomFull`, `RoomNotFound`

### Coordenadas

3 sistemas paralelos por casa: `algebraic` (`"e4"`), `file/rank` (`'e'`, `4`), e `row/column` (0..7 internos). UI usa `algebraic` em todas as chamadas; mantém `row/column` só para layout do grid.

### Auth

- JWT em `localStorage.accessToken${userId}` + refresh em `localStorage.refreshToken${userId}`.
- `userId` = Guid (backend exige `Guid.TryParse` em refresh).
- `sessionStorage.currentUserId` usado pelo axios interceptor para escolher token.
- SignalR autentica via `accessTokenFactory` (query string `?access_token=...` no handshake).
- Backend valida `JWT.sub == body.userId`. Mismatch = 403.

### Tratamento de erros

- `MakeMoveResponse.success === false` → exibe `message` (ex: `"Not your turn."`, `"That piece is not yours."`).
- `RoomNotFound` / `RoomFull` → mensagem no lobby.
- `useChessGame.lastMoveError` expõe último erro de movimento.

### Testes

- Unit: ao lado dos arquivos. Hub mockado via `createFakeHub`, REST via `axios-mock-adapter`.
- Integration: `src/integration/`. MSW handlers em `src/mocks/handlers.ts`.
- E2E: `tests-e2e/`. Playwright sobe dev server (`webServer`) + `page.route` mocks.

## Pendente

- `npx playwright install chromium` antes do primeiro E2E.
- Manter sincronizado com `BACKEND_CHANGES.md` / doc do backend (Hibrygame Orchestrator).
