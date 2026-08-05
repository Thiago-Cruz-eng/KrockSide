# AGENTS.md — KrockSide

Instruções canônicas deste repositório para agentes de código. `CLAUDE.md` e
`.github/copilot-instructions.md` são apenas ponteiros para este arquivo — nenhuma convenção é
duplicada neles. O `CLAUDE.md` da raiz hospeda também o bloco entre
`<!-- SPECKIT START -->` e `<!-- SPECKIT END -->`, que é **gerenciado pelo Spec Kit** e não deve
ser editado à mão.

## Leia antes de agir (ordem obrigatória)

1. **Constituição do projeto — [`.specify/memory/constitution.md`](.specify/memory/constitution.md).**
   Obrigatória antes de qualquer decisão de arquitetura (componente novo, hook novo, chamada nova
   ao backend, mudança de estado global). Os princípios **I (Autoridade do servidor)** e
   **II (Contrato explícito)** são NON-NEGOTIABLE.
2. **Skills em [`.agents/skills/`](.agents/skills/) — fonte de verdade do domínio.** Consulte a
   skill pertinente **antes** de implementar. Ela **tem precedência sobre padrões inferidos do
   código existente**, porque parte do código atual está divergente do backend (ver item 5).
3. **Verificação obrigatória antes de criar ou editar arquivo:** confira se existe skill que
   governa o caso — pela **tecnologia** (SignalR, autenticação, testes, React/TS) ou pelo
   **domínio** (lobby, tabuleiro, contrato do backend).
4. **Mapa funcional — [`.agents/maps/functional-map.md`](.agents/maps/functional-map.md)** e
   **[`.agents/context/discovery-answers.md`](.agents/context/discovery-answers.md)**.
5. **[`docs/debito-tecnico.md`](docs/debito-tecnico.md) — leia sempre.** Este front-end tem
   **divergências reais e conhecidas contra o backend em produção local** — hoje principalmente o
   payload de cadastro (DT-03) e os claims declarados em `DecodedToken` (DT-04). Antes de
   "consertar" ou de construir em cima de qualquer um desses pontos, confirme o que já está
   catalogado: aquele arquivo é a lista viva, e **ele** manda sobre o que ainda está aberto.

## Visão geral

Front-end React + TypeScript do xadrez multiplayer. Consome o backend
**Hibrygame Orchestrator** (ASP.NET Core 8) por dois canais:

- **REST** (`axios`) — login, refresh, cadastro, dados do usuário, endpoints de validação;
- **SignalR** (`@microsoft/signalr`) — hub `/chesshub`, onde a partida acontece.

Projeto **pessoal em retomada**, sem usuário em produção. Consequência prática: quebrar contrato é
barato e corrigir divergência vale mais que preservar comportamento atual.

**O estado real hoje (verificado em 2026-08-03):** o fluxo de jogo funciona ponta a ponta — login,
lobby, entrar em sala, mover peça, xeque-mate. A cor do jogador vem de `JoinRoom` e é guardada em
`src/service/gameSession.ts`; o tabuleiro é invertido para quem joga de pretas. As duas coisas eram
DT-01 e DT-09 e **saíram** da lista de débito.

O que **ainda** diverge do backend: o payload de cadastro (DT-03) e os claims declarados em
`DecodedToken` (DT-04). Nenhum dos dois bloqueia jogar.

## Stack

| Área | Tecnologia |
|---|---|
| Framework | React 18 + TypeScript 5.9 |
| Build e dev server | **Vite 7** (`vite.config.ts`) — o `react-scripts`/CRA **saiu** em 2026-08-01. Porta fixa em 3000 de propósito: é a origem que o CORS do backend libera e a que o Playwright aponta |
| Roteamento | `react-router-dom` 6 (`Routes`/`Route`, `useParams`, `useNavigate`) |
| Real-time | `@microsoft/signalr` 8 atrás do contexto `HubProvider` / hook `useHubConnection` |
| HTTP | `axios` 1.6 com interceptor de `Authorization` em `src/service/Api.ts` |
| Token | `jwt-decode` 4 (import nomeado `jwtDecode`) |
| Estado | `useState`/`useContext` — **sem** Redux, Zustand, React Query ou SWR |
| Estilo | CSS puro por componente em `src/styles/`, com `tokens.css` de variáveis — **sem** Tailwind, CSS-in-JS ou Sass |
| Teste unitário | **Vitest 3** (configurado dentro do `vite.config.ts`) + `@testing-library/react` + `axios-mock-adapter` |
| Teste de integração | **MSW 2** (`http`/`HttpResponse`, não o `rest` da v1) em `src/mocks/` |
| Teste E2E | Playwright 1.45 em `tests-e2e/`, com `page.route` para mockar o backend |
| Lint | **ESLint 9 em flat config própria** (`eslint.config.js`): `typescript-eslint` 8 + `eslint-plugin-react-hooks` 7. Script `npm run lint` com `--max-warnings 0`. Ainda **sem** formatter (Prettier) — ver DT-11 |
| Cobertura | `@vitest/coverage-v8` com piso configurado no `vite.config.ts` (catraca, não meta — leia o comentário de lá antes de mexer) |

Dependência nova exige justificativa: o projeto é deliberadamente enxuto. Nada de biblioteca de
estado, de UI kit ou de camada de dados sem decisão explícita registrada.

## Estrutura

```
src/
  components/   App, Login, ChessLobby, ChessBoard, ChessSquare, ChessPiece (+ *.test.tsx ao lado)
  hooks/        useAuth, useHubConnection (contexto + provider), useChessGame, useChessLobby
  service/      Api.ts (axios + storage de token), userApi.ts (REST), gameSession.ts (cor/nome por sala)
  types/        auth.ts, chess.ts (DTOs do backend + helpers de coordenada)
  mocks/        MSW 2: handlers.ts, server.ts (node), browser.ts
  test-utils/   hub.tsx — createFakeHub + HubTestProvider
  integration/  testes de fluxo com MSW
  styles/       CSS por componente + tokens.css (variáveis)
  setupTests.ts bootstrap do Vitest (jest-dom, servidor MSW)
  index.tsx     ponto de entrada: HubProvider acima do Router
tests-e2e/      especificações Playwright
public/         imagens das peças ({color}-{type}.png)
index.html      entrada do Vite (fica na RAIZ, não em public/)
.specify/       Constituição + templates + scripts + extensão git do Spec Kit
specs/          Especificações de feature do Spec Kit
.agents/        Skills, mapa funcional e memória de descoberta
docs/           Contrato do backend, débito técnico e guia do desenvolvedor
.claude/        Agentes, skills e permissões do Claude Code
```

Não existe `src/utils/`: o `reportWebVitals` do CRA saiu junto com o `react-scripts`.

## Convenções de arquitetura (não negociáveis)

- **O servidor é a autoridade.** O front **nunca** decide se uma jogada é legal, de quem é o turno,
  qual a cor do jogador ou o que ele pode acessar. `GetPossibleMoves` serve para **destacar** casas,
  não para autorizar: `MakeMove` é enviado e o servidor decide. **É proibido atualizar o tabuleiro
  de forma otimista** — o estado novo vem sempre do `snapshot` da resposta ou do evento
  `BoardChanged`.
- **Fluxo de camadas** — `components → hooks → service → types`. Componente **não** importa `axios`
  nem `@microsoft/signalr` direto: usa `userApi` e `useHubConnection`/`useChessGame`. Hook não
  renderiza; serviço não conhece React.
- **Contrato do backend vive em `src/types/`.** Todo DTO de REST e de hub é declarado lá, em
  camelCase (o backend serializa camelCase tanto no MVC quanto no SignalR). Mudança de contrato é
  registrada em [`BACKEND_CHANGES.md`](BACKEND_CHANGES.md) **no mesmo PR**.
- **Tipagem estrita** — `strict: true` no `tsconfig`. Payload de evento de hub chega como
  `unknown[]`: faça o cast na borda (`args[0] as BoardChangedEvent`) **em um único lugar** e trafegue
  tipado dali para frente. `any` é proibido; `as any` também.
- **Coordenada é algébrica na fronteira.** Toda chamada ao hub usa `"e2"`/`"e4"`.
  `row`/`column` existem apenas para o layout do grid e vêm dos helpers de `src/types/chess.ts`
  (`toAlgebraic`, `fileFromRow`, `rankFromColumn`). Nunca reimplemente a conversão inline.
- **Token nunca em URL** — REST vai por header `Authorization: Bearer` (interceptor do
  `createApi`). A única exceção é o handshake do SignalR, que usa `accessTokenFactory` (o cliente
  coloca em query string; é o que o backend aceita apenas para `/chesshub`).
- **Storage de token é por usuário** — `localStorage.accessToken{userId}` e
  `refreshToken{userId}`, mais `sessionStorage.currentUserId` para o interceptor saber qual token
  usar. Nunca leia token direto do `localStorage` fora de `src/service/Api.ts`.
- **Seletor de teste estável** — componente novo expõe `data-testid` ou `role`/`label`
  associado. Teste não depende de classe CSS nem de texto solto de parágrafo.
- **Erro de negócio é mensagem, não exceção.** Resposta do hub e do REST vem com
  `success: false` + `message`. Exiba a `message` do servidor; não invente texto próprio para caso
  que o servidor já explica.

### Áreas críticas (maior risco de regressão)

- **`src/service/Api.ts`** — interceptor e storage de token. Todo request autenticado passa aqui;
  errar a chave do `localStorage` desloga todo mundo silenciosamente.
- **`src/hooks/useHubConnection.tsx`** — provider único de conexão, montado em `src/index.tsx`
  acima do `Router`. O `useEffect` depende de `[url, sessionEpoch]`, e a `factory` fica atrás de um
  `useRef` **fora** do array de dependências: antes ela entrava nas dependências, e quem passasse
  uma arrow inline recriava a função a cada render — o efeito derrubava e reabria a conexão SignalR
  junto, e a partida caía a cada re-render do provider. O `sessionEpoch` existe porque o provider
  monta antes de qualquer login: sem ele, o token que aparece no login nunca era usado, porque o
  `withAutomaticReconnect` do SignalR não repete uma conexão **inicial** que falhou.
- **`src/hooks/useChessGame.ts`** — reentra na sala (`rejoin`) e chama `StartGame` ao conectar
  (**todo** cliente chama, não só quem criou a sala — DT-07). A função `refresh` existe e **não é
  usada** por ninguém, e seria o caminho correto para reconexão.
- **`src/components/ChessBoard.tsx`** — orquestra a interação do tabuleiro. A cor do jogador vem de
  `getAssignedColor(roomName)` (servidor, via `JoinRoom`), **nunca** de claim do JWT — foi a DT-01, e
  derivar do claim `role` fazia `playerColor` ser sempre `'None'` e travava o tabuleiro inteiro. A
  orientação é invertida para as pretas (era a DT-09). A seleção de casa é espelhada num `useRef`
  porque dois cliques rápidos chegam antes do re-render, e sem o ref o segundo clique perdia a
  jogada.
- **`src/types/chess.ts`** e **`src/types/auth.ts`** — espelho do contrato do backend. Divergência
  aqui não quebra compilação, quebra em runtime.
- **`src/service/userApi.ts`** — quatro rotas divergem do backend real (DT-02). Não copie o padrão
  de rota daqui sem conferir a skill `contrato-do-backend`.

## Configuração

Não há `.env` versionado, apenas `.env.example`. Copie antes de rodar:

| Var | Default no código | Descrição |
|---|---|---|
| `VITE_API_BASE_URL` | `https://localhost:5001/` | base do REST |
| `VITE_HUB_URL` | `https://localhost:5001/chesshub` | hub SignalR |

**O prefixo é `VITE_`, não `REACT_APP_`.** O Vite expõe ao cliente apenas variáveis com esse
prefixo, lidas via `import.meta.env` — as antigas `REACT_APP_*` eram substituídas em build pelo
`react-scripts` e hoje **não têm efeito nenhum**. Mudar `.env` exige reiniciar o dev server.

Cuidado com um efeito colateral: o Vitest também carrega o `.env`. Se você apontar a API para
`http://` num `.env` local, os handlers do MSW — que derivam a base de `API_BASE_URL` — passam a
casar `http`, e é isso que se quer. Handler com base fixa em `https` deixaria os testes de
integração falharem com a mensagem de `catch` do componente ("Falha ao fazer login"), sugerindo bug
de UI onde há divergência de mock. Ver o comentário em `src/mocks/handlers.ts`.

O backend roda em `https://localhost:5001` com certificado de desenvolvimento: aceite o
certificado no browser antes do primeiro uso, ou o handshake do hub falha sem mensagem clara.

## Comandos essenciais

```bash
cp .env.example .env
npm install
npm run dev                # dev server em http://localhost:3000 (`npm start` é alias)
npm test                   # Vitest single-run (`vitest run`)
npm run test:watch         # Vitest em watch
npm run test:ci            # Vitest single-run com coverage e pisos
npm run lint               # ESLint com --max-warnings 0
npm run typecheck          # tsc --noEmit
npm run build              # tsc --noEmit && vite build
npx playwright install chromium   # uma vez, antes do primeiro E2E
npm run test:e2e           # Playwright headless (sobe o dev server sozinho)
npm run test:e2e:ui        # Playwright em modo UI
```

Atenção: `npm test` aqui é **single-run**, não watch — o inverso do que o CRA fazia. Para watch use
`npm run test:watch`.

Os gates automáticos são `npm run typecheck`, `npm run lint`, `npm run test:ci` e `npm run build`,
e eles rodam no CI (`.github/workflows/ci.yml`). `npm run build` roda `tsc --noEmit` antes do
`vite build`, então erro de tipo quebra o build — mas não conte com isso: o `vite build` sozinho
**não** checa tipo, diferente do que o `react-scripts` fazia.

### Armadilha de ambiente: `npm` falha com EPERM

Nesta máquina o `npm` do `PATH` resolve por um symlink do nvm4windows que aponta para o perfil de
outro usuário, e estoura:

```
Error: EPERM: operation not permitted, lstat 'C:\Users\dgs-admin\AppData'
```

`node` funciona; é só a resolução do `npm-cli.js` que falha. Duas saídas, ambas verificadas:

```powershell
# 1. Prefixar o Node do Program Files no PATH da sessão (preferido)
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm run test:ci

# 2. Chamar as ferramentas locais direto, sem npm
node .\node_modules\typescript\bin\tsc --noEmit
node .\node_modules\eslint\bin\eslint.js . --max-warnings 0
node .\node_modules\vitest\vitest.mjs run
```

Se um documento deste repositório afirmar que a suíte não pôde ser executada, é resquício de antes
desse contorno ser conhecido — **rode antes de acreditar**.

## Convenções transversais

- **Branch e PR** — feature conduzida pelo **Spec Kit** nasce como `NNN-slug` (criada por
  `speckit.git.feature`; os scripts de `.specify/scripts/powershell/` falham fora desse formato);
  trabalho fora do fluxo usa `feat/<slug>` ou `fix/<slug>`. Não commitar direto na `main`.
  PR usa `.github/PULL_REQUEST_TEMPLATE.md`.
- **Idioma** — texto de UI em **português**; código, tipo, nome de arquivo e commit em **inglês**.
  Mensagem de erro vinda do servidor é exibida como veio (o backend responde em inglês).
- **Encoding** — `.md`, `.ts` e `.tsx` em UTF-8 com acentuação preservada. Normalização ASCII só em
  mensagem de commit.
- **Documentação viva** — `README.md` (visão geral e contratos), `BACKEND_CHANGES.md` (o que o
  backend precisa mudar / contrato acordado), `docs/debito-tecnico.md` (débito e divergência) são
  atualizados **no mesmo PR** que muda o código.
- **Componente** — `React.FC` com props tipadas em `interface {Nome}Props` exportada; um arquivo
  por componente; teste ao lado (`{Nome}.test.tsx`); CSS em `src/styles/{Nome}.css` importado no
  topo do componente.
- **Hook** — `use{Nome}` em `src/hooks/`, retornando objeto (não tupla) com API nomeada e
  interface exportada (`ChessGameApi`, `HubConnectionApi`, `AuthState & AuthActions`). Toda função
  devolvida é `useCallback`.
- **Não adotar sem pedido explícito** — Redux/Zustand/Jotai, React Query/SWR,
  Tailwind/styled-components, Next.js, biblioteca de xadrez (`chess.js`, `react-chessboard`). A
  regra de xadrez é do backend; trazer engine para o cliente viola o Princípio I.

  (Vite, MSW 2 e ESLint próprio **já foram adotados** em 2026-08-01, quando o CRA saiu — não estão
  mais nesta lista. Prettier continua fora, e é o que resta do DT-11.)

## Estrutura `.agents/`

| Pasta | Papel |
|---|---|
| `.agents/context/` | Memória da descoberta: objetivo, restrições herdadas, divergências validadas e decisões pendentes (`discovery-answers.md`) |
| `.agents/maps/` | Mapa funcional dos contextos do front (`functional-map.md`) |
| `.agents/skills/` | Skills sob demanda: **de domínio** (lobby, tabuleiro) e **técnicas** (contrato do backend, SignalR, autenticação, testes, padrões React/TS) |

O carregamento é dirigido pelo `description` do frontmatter de cada skill — não existe índice
manual e nenhum deve ser criado. As skills de autoria (`skill-authoring`, `spec-authoring`,
`plan-authoring`, `tasks-authoring`, `task-execution-authoring`, `test-cases-authoring`) são
**moldes**, não documentação de domínio.

## Fluxo de especificação — Spec Kit

Fluxo único, sem concorrente. Comandos disponíveis como skills: `speckit-constitution`,
`speckit-specify`, `speckit-clarify`, `speckit-plan`, `speckit-tasks`, `speckit-analyze`,
`speckit-checklist`, `speckit-implement`, `speckit-taskstoissues`, mais a extensão git
(`speckit-git-feature`, `speckit-git-commit`, `speckit-git-initialize`, `speckit-git-remote`,
`speckit-git-validate`). Os scripts são PowerShell (`"script": "ps"` em
`.specify/init-options.json`).

**Ponto de integração (não quebrar).** `"context_file": "CLAUDE.md"`: o `speckit.plan` reescreve o
ponteiro do plano ativo entre `<!-- SPECKIT START -->` e `<!-- SPECKIT END -->` no `CLAUDE.md` da
raiz. Não remova os marcadores, não edite o conteúdo entre eles à mão, e não mova o `context_file`
para `AGENTS.md`.

## Relação com o backend

O backend **Hibrygame** vive em repositório separado (`../Hibrygame`) e tem harness próprio, com
constituição, skills e contrato documentado em `docs/FRONTEND_CHANGES.md`. Ao mexer em contrato:

1. leia `docs/FRONTEND_CHANGES.md` **do backend** — é a fonte de verdade do que o servidor entrega;
2. ajuste `src/types/` para refletir o que existe, não o que se desejava;
3. se a mudança precisa acontecer **no backend**, registre em `BACKEND_CHANGES.md` deste repositório
   com o contrato antigo, o novo e o motivo — e não implemente o cliente contra um endpoint que
   ainda não existe sem marcar isso claramente.

`BACKEND_CHANGES.md` tem uma seção **desatualizada** ("Hub method names (unchanged)") que lista
nomes que o backend não usa (`GetAvailableRoom`, `SendPossiblesMoves`, `BoardChange`,
`GameWillStart`). A lista correta está no `README.md` deste repositório e na skill
`contrato-do-backend`. Ver DT-05.

## Contexto por diretório

| Arquivo | O que cobre |
|---|---|
| [`.claude/CLAUDE.md`](.claude/CLAUDE.md) | Referência rápida: stack, layout, convenções resumidas, índice do harness |
| [`README.md`](README.md) | Visão geral, setup, scripts, contratos do hub, coordenadas, auth |
| [`BACKEND_CHANGES.md`](BACKEND_CHANGES.md) | Contrato acordado com o backend e mudanças pedidas a ele |
| [`docs/guia-do-desenvolvedor.md`](docs/guia-do-desenvolvedor.md) | Guia de tarefa para quem está chegando: receitas (componente, hook, chamada REST, evento de hub, tabuleiro), armadilhas do repositório e onde não mexer |
| [`docs/debito-tecnico.md`](docs/debito-tecnico.md) | Divergências com o backend, débito conhecido e decisões pendentes |
