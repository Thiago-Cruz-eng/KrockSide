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
- `@microsoft/signalr` 8.0.29 (oficial) via hook `useHubConnection`
- `axios` 1.20 com interceptor de `Authorization: Bearer` **e** interceptor de refresh
  single-flight em 401 (`src/service/Api.ts`)
- `react-router-dom` 6.30, com `RequireAuth` nas rotas autenticadas
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
- `CreateRoom(name) → CreateRoomResponse { success, message?, room, alreadyExisted }`
  (`success: false` para nome inválido ou teto de salas)
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

Modelo revisado no hardening de 2026-09-23 (detalhe na skill
[`autenticacao-e-sessao`](./.agents/skills/autenticacao-e-sessao/SKILL.md) e em
[`docs/seguranca.md`](./docs/seguranca.md)):

- JWT em `sessionStorage.accessToken${userId}` + refresh em `sessionStorage.refreshToken${userId}`
  — **por aba**: morre ao fechar, sobrevive a F5; duas abas são duas sessões independentes.
  Só `src/service/Api.ts` lê ou escreve essas chaves.
- `sessionStorage.currentUserId` diz ao interceptor e ao hub qual token usar. `useAuth` só o grava
  quando há token para o `:id` da rota **com `sub` igual ao id** e no prazo — trocar o id na URL
  não herda sessão.
- `RequireAuth` envolve `/chess-lobby/:id` e `/chess-board/:roomName/:id`: sem sessão →
  redireciona para `/`.
- **Refresh automático:** 401 em endpoint autenticado → um refresh (single-flight) → grava o par
  novo (rotação) → repete a requisição. Refresh recusado → `clearAllStoredTokens()` + volta ao
  login. Nunca para `login`/`register`/`refresh-token`.
- "Sair" faz logout real (apaga todo token da aba). "Sair da partida" chama `LeaveRoom` e volta ao
  lobby sem encerrar a sessão.
- 429 (`Too many requests`, com `Retry-After`) em login/cadastro exibe "Muitas tentativas. Aguarde
  um minuto e tente novamente." Senha de cadastro: 8 a 128 caracteres.
- `userId` = Guid (backend exige `Guid.TryParse` em refresh; `getUser` só aceita Guid e o backend
  responde 404 para id que não é o próprio).
- SignalR autentica via `accessTokenFactory` (query string `?access_token=...` no handshake) — a
  única exceção ao "token nunca em URL". Cookie `HttpOnly` depende do backend (DT-17).
- Backend valida `JWT.sub == body.userId`. Mismatch = 403.
- Nome de sala: `^[\p{L}\p{N} _-]{1,64}$`, conferido no cliente e no servidor; a rota do tabuleiro
  leva o nome com `encodeURIComponent`.

### Tratamento de erros

- `MakeMoveResponse.success === false` → exibe `message` (ex: `"Not your turn."`, `"That piece is not yours."`).
- `RoomNotFound` / `RoomFull` → mensagem no lobby.
- `useChessGame.lastMoveError` expõe último erro de movimento.

### Testes

Três camadas, cada uma pegando o que a de cima não pega:

- **Unit** — ao lado dos arquivos. Hub mockado via `createFakeHub`, REST via `axios-mock-adapter`;
  o interceptor de refresh é testado com MSW (a renovação sai por uma instância axios própria).
  JWT de teste em `src/test-utils/jwt.ts`.
- **Integração** — `src/integration/`. MSW handlers em `src/mocks/handlers.ts` (inclui refresh com
  sucesso, `failedRefresh` e `rateLimitedLogin`).
- **E2E** — `tests-e2e/` (38 testes; a suíte de acessibilidade roda em dois temas). Navegador real
  → Vite → API .NET → MongoDB, **sem mock em camada nenhuma**. O `playwright.config.ts` sobe as
  duas pontas e o `global-setup.ts` cadastra os usuários via `POST /register`, então não há
  pré-requisito manual além de um MongoDB de pé.

Unit + integração: **127 testes em 12 arquivos** (`npm run test:ci`, 2026-09-23), com piso de
cobertura em `vite.config.ts`.

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
| `build-and-test` | `npm audit --omit=dev --audit-level=high` (**bloqueante**, só deps de produção) + audit informativo completo + lint + `tsc --noEmit` + unit/integração + build | ~3 min |
| `e2e` | MongoDB em service container, checkout dos dois repos, sobe API + Vite, roda os 38 testes; trace/vídeo/screenshot das falhas como artifact | ~15-20 min |

O job `e2e` precisa do backend, que vive em outro repositório, e resolve qual ref usar nesta
ordem: variável `HIBRYGAME_REF` (escape manual) → **branch de mesmo nome no Hibrygame** → `main`.

Daí a convenção: **em mudança que toca as duas pontas, use o mesmo nome de branch nos dois
repos.** Cada PR passa a ser testado contra a metade correspondente do outro lado, sem configurar
nada. O gate espelho existe lá (`e2e.yml` no Hibrygame) — sem ele, uma mudança no hub ou num DTO
quebraria o front sem gate nenhum.

O passo a passo completo — os três formatos de demanda (back+front, só back, só front), onde cada
teste mora e a janela entre os dois merges — está em
[docs/fluxo-de-trabalho.md](https://github.com/Thiago-Cruz-eng/Hibrygame/blob/main/docs/fluxo-de-trabalho.md).

### Segurança e publicação

O que o front já faz (sessionStorage, logout total, refresh automático, guarda de rota, CSP de
build, `sourcemap: 'hidden'`, audit bloqueante) e o que **só o host** consegue fazer (headers HTTP:
`frame-ancestors`, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`), com exemplos para nginx e Azure Static Web Apps e o checklist de produção,
está em [`docs/seguranca.md`](./docs/seguranca.md). A CSP é injetada como meta tag **só no
`vite build`** — o dev server precisa de script inline e `ws:` para o HMR.

## Pendente
- Manter sincronizado com `BACKEND_CHANGES.md` / doc do backend (Hibrygame Orchestrator).
- Cookie `HttpOnly` + CSRF para o token (DT-17) — depende do backend.
