# KrockSide

React + TypeScript chess multiplayer frontend. Backend: ASP.NET Core SignalR hub + REST (Hibrygame Orchestrator).

> **Novo no repositório? Comece por
> [`docs/guia-do-desenvolvedor.md`](./docs/guia-do-desenvolvedor.md)** — receitas passo a passo
> (componente novo, hook novo, chamada ao backend, evento de hub, mexer no tabuleiro), as armadilhas
> conhecidas e onde não mexer sem conversar.

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

Três camadas, cada uma pegando o que a de cima não pega:

- **Unit** — ao lado dos arquivos. Hub mockado via `createFakeHub`, REST via `axios-mock-adapter`.
- **Integração** — `src/integration/`. MSW handlers em `src/mocks/handlers.ts`.
- **E2E** — `tests-e2e/` (28 testes). Navegador real → Vite → API .NET → MongoDB, **sem mock em
  camada nenhuma**. O `playwright.config.ts` sobe as duas pontas e o `global-setup.ts` cadastra
  os usuários via `POST /register`, então não há pré-requisito manual além de um MongoDB de pé.

O E2E não é redundância: a versão anterior deste diretório mockava o backend com `page.route`,
inclusive em `**/get/**` — a rota **errada** que o front chamava. O dublê espelhava o bug, o teste
passava, e entrar em sala respondia 404 em produção. Dublê não pega erro de junção.

```bash
npx playwright install chromium   # uma vez
npm run test:e2e
E2E_SKIP_API_START=true npm run test:e2e   # quando a API já está no ar
```

### CI

`.github/workflows/ci.yml`, dois jobs em paralelo a cada PR para `main`:

| Job | O que faz | Custo |
|---|---|---|
| `build-and-test` | lint + `tsc --noEmit` + unit/integração + build | ~3 min |
| `e2e` | MongoDB em service container, checkout dos dois repos, sobe API + Vite, roda os 28 testes; trace/vídeo/screenshot das falhas como artifact | ~15-20 min |

O job `e2e` precisa do backend, que vive em outro repositório, e resolve qual ref usar nesta
ordem: variável `HIBRYGAME_REF` (escape manual) → **branch de mesmo nome no Hibrygame** → `main`.

Daí a convenção: **em mudança que toca as duas pontas, use o mesmo nome de branch nos dois
repos.** Cada PR passa a ser testado contra a metade correspondente do outro lado, sem configurar
nada. O gate espelho existe lá (`e2e.yml` no Hibrygame) — sem ele, uma mudança no hub ou num DTO
quebraria o front sem gate nenhum.

O passo a passo completo — os três formatos de demanda (back+front, só back, só front), onde cada
teste mora e a janela entre os dois merges — está em
[docs/fluxo-de-trabalho.md](https://github.com/Thiago-Cruz-eng/Hibrygame/blob/main/docs/fluxo-de-trabalho.md).

## Pendente
- Manter sincronizado com `BACKEND_CHANGES.md` / doc do backend (Hibrygame Orchestrator).
