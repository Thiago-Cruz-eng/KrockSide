# Débito técnico — KrockSide

Documento vivo. Registro central de divergência com o backend e de débito conhecido, com severidade
e caminho de saída. Item marcado `[DECISÃO]` exige definição humana antes de implementação.

**Regras deste arquivo**

- Item resolvido **sai** desta lista e é citado no PR que o resolveu.
- Ao encontrar divergência nova, registre aqui **antes** de corrigir de passagem.

- A fonte de verdade do que o backend entrega é `docs/FRONTEND_CHANGES.md` **do repositório
  `../Hibrygame`**, não este arquivo e não o código atual deste repositório.

**Levantamento inicial:** 2026-08-01, comparando `src/` contra o backend Hibrygame real
(`Orchestrator/Presentation/UserController.cs`, `ValidationController.cs`,
`Infra/SignalR/ChessHub.cs`, `UseCases/Security/TokenService.cs`).

> **Revisão 2026-08-01** (`refactor/motor-xadrez-modernizacao`). Saíram desta lista:
>
> - **DT-01** — a cor agora vem de `JoinRoom`, guardada em `src/service/gameSession.ts`. O
>   tabuleiro voltou a aceitar jogada.
> - **DT-02** — as três rotas erradas (`create`, `get/{id}`, `refresh`) foram corrigidas para
>   `users`, `users/{id}` e `refresh-token`, junto com os mocks. Encontrado batendo no backend
>   real: os dublês reproduziam o mesmo erro do código, então a suíte não podia pegar.
> - **DT-08** — o primeiro jogador navega ao entrar, e o tabuleiro espera o adversário em vez
>   de mostrar erro.
> - **DT-12** — MSW 2.
>
> Entrou **DT-15**. Parte do **DT-03** foi resolvida: `GetUserResponse` agora declara o contrato
> real (`name`, não `userName`) — o campo era sempre `undefined` e o `if (!user.userName) return`
> abortava a entrada na sala em silêncio. O resto do DT-03 (payload de cadastro) segue aberto.
>
> A suíte **rodou** nesta revisão: 54 testes passando. O aviso ambiental sobre o npm continua
> válido — use `"C:\Program Files\nodejs\npm.cmd"`, porque `npm` puro falha com `EPERM` neste
> ambiente. Ver o relatório completo em
> [`../../Hibrygame/docs/refactor-2026-08-01.md`](../../Hibrygame/docs/refactor-2026-08-01.md)
> e os resultados do smoke em
> [`../../Hibrygame/docs/manual-testing-results.md`](../../Hibrygame/docs/manual-testing-results.md).

> **Revisão 2026-08-03** (preparação do repositório para manutenção por equipe júnior). Saíram desta
> lista — os três estavam **resolvidos no código e ainda listados aqui**:
>
> - **DT-09** — o tabuleiro é invertido para as pretas. `ChessBoard` deriva `flipped` de
>   `playerColor === 'Black'` e inverte a ordem de iteração de linhas e colunas (hoje em
>   `useBoardOrientation`). Estava desbloqueado desde que `getAssignedColor` passou a dar a cor
>   confiável.
> - **DT-03** — o payload de cadastro está alinhado. `RegisterRequest` é
>   `{ name, email, password, passwordConfirmation }`, `CreateUserRequest` declara `role` e perdeu
>   `dateBirth`/`phoneNumber`, e `GetUserResponse` declara `name`. Foi seguida a opção (b) do item
>   original: o backend ganhou `POST /register`, que deriva papel e autor no servidor e devolve
>   sessão pronta — então `Login.handleRegister` já navega com token em mãos.
> - **DT-14** — `Login` não tem mais `dateBirth` nem `phoneNumber` no estado. O formulário declara
>   exatamente os quatro campos que envia.
>
> Atualizado:
>
> - **DT-11** — o workflow de CI **existe** (`.github/workflows/ci.yml`, mais `codeql.yml`). O que
>   falta do item é apenas o formatter.
>
> Estado verificado: `tsc --noEmit` limpo, `eslint --max-warnings 0` limpo, **72 testes passando em
> 10 arquivos**. O contorno do `npm` está documentado no `AGENTS.md`: prefixar
> `C:\Program Files\nodejs` no `PATH` da sessão resolve, e chamar as ferramentas de
> `node_modules` direto também.

> **Revisão 2026-09-23** (`chore/politica-dependencias-002` — hardening de segurança pré-produção,
> a partir da auditoria OWASP do front). Nada aqui era item numerado; eram lacunas que a skill
> `autenticacao-e-sessao` descrevia como "hoje não existe". **Saíram**:
>
> - **Logout inexistente** — "Sair" só navegava para `/` e o token ficava no storage; quem
>   digitasse a URL do lobby voltava logado. Agora `useAuth.logout` chama `clearAllStoredTokens()`,
>   que apaga todo token de todo usuário e avisa o `HubProvider`.
> - **Refresh nunca usado** — `userApi.refresh` existia e ninguém chamava; o token expirava em 60
>   min e o app começava a receber 401. Agora há interceptor de resposta em `createApi` (401 → um
>   refresh single-flight → rotação dos dois tokens → repetição da requisição) e renovação
>   proativa em `useAuth` para token expirado com refresh disponível.
> - **Sem guarda de rota** — `/chess-board/...` abria sem token e falhava chamada a chamada. Agora
>   `RequireAuth` envolve as duas rotas autenticadas, e `useAuth` só aceita o `:id` da rota se há
>   token para ele com `sub` igual ao id.
> - **Token em `localStorage`** — passou a `sessionStorage` (por aba; morre ao fechar). Duas abas
>   são duas sessões independentes; reload preserva.
> - **Dependências de runtime com advisory `high`/`critical`** — `axios` 1.6.7 → 1.20.0,
>   `react-router-dom` 6.21.3 → 6.30.6, `@microsoft/signalr` 8.0.17 → 8.0.29, `ws` transitivo
>   7.5.10 → 7.5.13. Todos dentro do semver já declarado; o motivo (advisory em código que vai ao
>   navegador) é o que a política de upgrade exige. `npm audit --omit=dev`: de **7 (1 moderate,
>   5 high, 1 critical)** para **2 moderate** (react-router, só em major — ver DT-18).
>
> **Entraram** DT-17, DT-18 e DT-19 (abaixo). Removida a chave `allowScripts` do `package.json`:
> era do `@lavamoat/allow-scripts`, que não está instalado — não fazia nada e sugeria uma proteção
> que não existia.
>
> Estado verificado: ver o relatório da mudança. Contagem de testes e cobertura estão no
> `AGENTS.md`; o piso do `vite.config.ts` subiu junto.

## Severidade alta — o jogo não funciona

### DT-15 — regra `react-hooks/set-state-in-effect` desligada

Regra do `eslint-plugin-react-hooks 7`, voltada ao React Compiler. Acusa três sítios que são o
padrão "carregar na montagem" — `useChessGame` (`void start()`), `useChessLobby`
(`void loadRooms()`) e `useAuth` (ressincroniza o token quando o `userId` da rota muda) — onde o
`setState` acontece depois de um `await`, e o linter acusa o sítio da chamada.

Desligada em 2026-08-01, com a razão escrita no próprio `eslint.config.js`. No mesmo lote, os
erros de `react-hooks/refs` **eram** bugs reais e foram corrigidos: `connection` saiu do contexto
do hub (era sempre `null` no primeiro render) e a reatribuição de `factoryRef.current` durante o
render foi removida.

- **Arquivo**: `eslint.config.js`
- **Saída**: reescrever os três com `useSyncExternalStore` (ou equivalente) e religar a regra. É
  refactor da camada de estado, não conserto pontual.

### DT-04 — `DecodedToken` declara claims que o backend não emite

`src/types/auth.ts` declara `emailAddress` e `role`. O backend emite `sub`, `email`, `name`, `jti`
e o papel na chave longa de `ClaimTypes.Role`. Portanto `decoded.emailAddress` é sempre `undefined`
e `decoded.role` também (ver DT-01).

- **Saída**: renomear para `email` e ler o papel pela chave completa
  (`decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']`) — ou, melhor, pedir
  ao backend que emita o papel também como claim `role` curta, registrando em
  `BACKEND_CHANGES.md`. Não use o papel para cor em nenhuma hipótese (DT-01).

## Severidade média

### DT-05 — `BACKEND_CHANGES.md` tem uma seção desatualizada e contraditória

A seção "Hub method names (unchanged)" lista `GetAvailableRoom`, `SendPossiblesMoves`,
`GetPositionInBoard`, `GetPositionPlaced` e os eventos `BoardChange`, `CreateRoom`,
`GameWillStart`. Nenhum desses existe no backend atual, e o `README.md` deste repositório lista os
nomes corretos (`GetAvailableRooms`, `GetPossibleMoves`, `GetBoardSnapshot`, `BoardChanged`,
`GameStarted`). Dois documentos do mesmo repositório se contradizem sobre o contrato.

- **Saída**: reescrever a seção com os nomes reais e datar; ou removê-la e apontar para a lista do
  `README.md`, deixando `BACKEND_CHANGES.md` só para o que ainda é pedido ao backend.

### DT-06 — respostas REST podem vir com `$id`/`$ref`/`$values` e nada trata isso

O backend serializa controllers com `ReferenceHandler.Preserve`. Objetos podem chegar com `$id`, e
listas como `{ "$id": "2", "$values": [...] }`. Nenhum ponto do front trata esse envelope. Hoje não
quebra porque as respostas usadas são planas, mas qualquer campo de lista (`Assignments`, por
exemplo) chega em formato inesperado.

Payload de **SignalR não** é afetado — o hub usa o protocolo JSON próprio, sem `Preserve`.

- **Saída**: `[DECISÃO]` — normalizar na borda (um `unwrapPreserve` no interceptor de resposta do
  axios) ou pedir ao backend para não usar `Preserve` nas rotas consumidas pelo front. A segunda é
  mais limpa e cabe em `BACKEND_CHANGES.md`.

### DT-07 — `StartGame` é chamado por todo cliente que conecta

`useChessGame` chama `StartGame` no `useEffect` sempre que o estado do hub vira `Connected`, para
qualquer jogador. `GameRoom.Start()` do backend é idempotente (`if (Started) return;`), então o
tabuleiro não é resetado — mas o hub reemite `GameStarted` para o grupo a cada chamada, e um
jogador que reconecta dispara `GameStarted` para o adversário no meio da partida.

`refresh` (que chamaria `GetBoardSnapshot`) existe na API do hook e **não é usada por ninguém** —
seria o caminho correto para reconexão.

- **Arquivo**: `src/hooks/useChessGame.ts`
- **Saída**: no `useEffect`, chamar `GetBoardSnapshot` (via `refresh`); chamar `StartGame` apenas
  quando o snapshot indicar `started === false` e houver dois jogadores — ou mover `StartGame` para
  uma ação explícita do lobby.

### DT-10 — o fluxo de validação do lobby é frágil e provavelmente desnecessário

`handleJoinRoom` faz, em sequência e antes de entrar na sala: `getUser`, `verifyValidation`,
`getValidation`, `updateValidation`. Três dos quatro abortam com `return` silencioso em caso
negativo — o usuário clica em "Entrar na Sala" e nada acontece, sem mensagem. Além disso, a coleção
`Validation` do backend é um mecanismo paralelo que o próprio `ChessHub` **não** consulta (é débito
declarado no backend), e a cor escolhida no lobby é gravada nela mas **ignorada** pelo servidor, que
atribui cor por ordem de chegada em `TryAssignColor`.

Ou seja: o seletor de cor do lobby não tem efeito real na cor da partida.

- **Arquivos**: `src/components/ChessLobby.tsx`, `src/service/userApi.ts`
- **Saída**: `[DECISÃO]` — acompanhar a decisão do backend sobre o destino da coleção `Validation`.
  Enquanto isso: (1) trocar todo `return` silencioso por `setErrorMessage` explícito; (2) parar de
  prometer escolha de cor na UI, ou exibir a cor **recebida** de `JoinRoom` em vez da escolhida.

### DT-17 — token acessível a JavaScript: cookie `HttpOnly` + CSRF dependem do backend

Depois do hardening de 2026-09-23 o token vive em `sessionStorage`, o que encurta a janela (morre com
a aba) mas **não** tira o token do alcance de um XSS: qualquer script na origem lê `sessionStorage`.
A saída definitiva é o backend emitir access e refresh token em cookie `HttpOnly; Secure; SameSite`,
com proteção CSRF (token sincronizado ou `SameSite=Strict` + header custom), e o hub deixar de
receber o token pela query string (`?access_token=`) — o cookie iria junto no handshake.

Enquanto isso não existe, o front não tem como fazer melhor sozinho: cookie sem `HttpOnly` é pior
que `sessionStorage` (vai em toda requisição **e** é legível por JS).

- **Arquivos**: `src/service/Api.ts` (storage), `src/hooks/useHubConnection.tsx`
  (`accessTokenFactory`)
- **Saída**: `[DECISÃO]` do backend — pedido registrado em `BACKEND_CHANGES.md` (2026-09-23), junto
  com a redução do access token para 15 min agora que o front renova sozinho. Quando o cookie
  existir: remover o storage de token do `Api.ts`, o interceptor de `Authorization` passa a ser
  `withCredentials: true`, e `RequireAuth` passa a consultar um endpoint `/me` em vez de decodificar
  o token.

### DT-18 — advisories que só se resolvem com major: `react-router` e `vitest`

`npm audit` aponta dois grupos sem correção dentro do semver declarado:

- **`react-router` / `react-router-dom` 6.x** — duas advisories **moderate**
  (GHSA-wrjc-x8rr-h8h6, open redirect via `\` em `<Link>`/`useNavigate`; GHSA-337j-9hxr-rhxg,
  deserialização em SSR hydration). A correção está só em `react-router-dom@7`. É dependência de
  **produção**, mas o CI bloqueia a partir de `high`, então não reprova. Exposição real aqui é
  baixa: o app não faz SSR e todo `navigate` recebe rota montada internamente (com
  `encodeURIComponent`), não entrada do usuário.
- **`vitest` 3.x** — advisory **moderate**, corrigida só em major. Dependência de
  **desenvolvimento**: não vai ao navegador, e o passo bloqueante do CI usa `--omit=dev`
  exatamente para isso.

Os dois são majors que a política do repositório (`AGENTS.md`, "Upgrade de dependência é decisão
humana") mantém fora de propósito — router 7 e Vitest 4 mudam comportamento onde a suíte não olha.

- **Arquivo**: `package.json`
- **Saída**: `[DECISÃO]` — subir `react-router-dom` para 7 no PR que precisar dele (com a nota de
  migração lida e a suíte E2E verde, porque é resolução de rota que muda); `vitest` 4 idem. Até lá,
  reavaliar a cada rodada do workflow `dependencias` se apareceu correção em 6.x/3.x.

### DT-19 — headers de segurança dependem do host, e ainda não há host

A CSP do build é uma meta tag, e meta tag não emite `frame-ancestors`, HSTS, `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy` nem `Permissions-Policy`. Tudo isso precisa ser
configurado no servidor que vai entregar o `build/` — que hoje não existe (o projeto roda só em
dev). A lista completa, com exemplos para nginx e Azure Static Web Apps, está em
[`docs/seguranca.md`](./seguranca.md).

Também depende do host: bloquear os `.map` (gerados por `sourcemap: 'hidden'`) e trocar o
`connect-src 'self' https: wss:` genérico da meta tag pelo host real da API.

- **Arquivos**: `vite.config.ts` (meta tag), `docs/seguranca.md` (o que falta)
- **Saída**: ao escolher o host, seguir o checklist de produção do `docs/seguranca.md` e versionar a
  configuração dele (`nginx.conf` ou `staticwebapp.config.json`) neste repositório.

## Severidade baixa

### DT-11 — sem formatter

Quase todo resolvido. Em 2026-08-01, ao sair o `react-scripts`, o lint passou a ser explícito
(ESLint 9 flat config + typescript-eslint) e ganhou `npm run lint` e `npm run typecheck`. O workflow
de CI existe — `.github/workflows/ci.yml` roda `npm ci`, `tsc --noEmit`, `test:ci` e `build`, mais
`codeql.yml` para o scan de segurança.

O que resta: **formatter**. Não existe Prettier nem o formatador do ESLint, então indentação e
quebra de linha continuam sendo acordo tácito. Em 2026-08-03 o `eslint.config.js` ganhou limites de
complexidade (`complexity`, `max-lines-per-function`, `max-depth`, `max-nested-callbacks`), que
travam o crescimento de complexidade mas não formatam nada.

- **Saída**: adotar Prettier — decisão pequena, mas é adoção de dependência e por isso está aqui em
  vez de feita de passagem.

### DT-13 — `SquareDto` de fallback é construído no componente

`ChessBoard` monta um `SquareDto` sintético quando a casa não vem no snapshot (`squareIndex.get`
falha). Isso mascara snapshot incompleto: em vez de aparecer erro, aparece tabuleiro plausível e
vazio. O backend sempre envia as 64 casas.

- **Saída**: se o snapshot não tem 64 casas, é erro de contrato — reportar em vez de preencher.

### DT-16 — o `ChessBoard` não trata snapshot incompleto, e o `getValidation` espera um 404 que não vem

Dois itens pequenos, os dois de "o cliente trata bem um caso que o servidor não produz":

- `ChessBoard.emptySquare` monta uma casa vazia sintética quando o snapshot não traz aquela notação
  (é o DT-13, ainda válido, agora com o código isolado numa função nomeada e comentada).
- `userApi.getValidation` converte **404** em `null`, mas o backend não responde 404 nesse caso:
  `GetValidationByUserToken` lança exceção quando não encontra e o controller não a trata, então o
  que chega é **500**, que o `catch` deixa propagar. O tratamento do front está correto para quando
  o backend for consertado; hoje é código inalcançável.

- **Saída**: acompanhar a correção no backend (registrada no `docs/guia-do-desenvolvedor.md` dele) e
  então confirmar que o caminho de `null` passa a ser exercido. Nada a fazer aqui antes disso.
