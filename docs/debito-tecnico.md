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

### DT-03 — o payload de cadastro é incompatível com o backend

`CreateUserRequest` do front envia `{ userName, email, password, passwordConfirmation, dateBirth,
phoneNumber }`. O backend `CreateUserRequest` exige `{ Name, Email, Password,
PasswordConfirmation, Role, CreatedBy, Assignments }` — sem `dateBirth` e sem `phoneNumber`, e com
`Role` e `CreatedBy` **obrigatórios** (`[Required]`).

`CreateUserResponse` também divergem: o front espera `{ success, email, accessToken, message,
userId }` e o backend devolve `{ Success, Message, UserId }` — **sem `accessToken`**. O
`Login.handleRegister` navega para o lobby após cadastro, mas nenhum token foi armazenado, então o
lobby cai em "Sessão inválida".

`GetUserResponse` idem: o front espera `{ userName, email }`, o backend devolve
`{ Id, Name, Email, Role, MustChangePassword, Assignments }` — `user.userName` é `undefined`, e
`handleJoinRoom` tem um `if (!user.userName) return;` que aborta silenciosamente.

- **Arquivos**: `src/types/auth.ts`, `src/service/userApi.ts`, `src/components/Login.tsx`,
  `src/components/ChessLobby.tsx`
- **Saída**: `[DECISÃO]` — alinhar em qual direção. Duas opções coerentes: (a) o front passa a
  enviar/ler o contrato atual do backend (mais rápido, mas obriga a mandar `Role` e `CreatedBy`
  do cliente, o que é exatamente o furo de segurança DT-04 do backend); (b) pedir ao backend um
  endpoint de auto-registro que derive papel e autor no servidor, registrando em
  `BACKEND_CHANGES.md`. A opção (b) é a correta; a (a) desbloqueia mais rápido.

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

### DT-09 — o tabuleiro nunca é invertido para as pretas

`ChessBoard` monta o grid com `col` de 0→7 (rank 8 no topo) e `row` de 0→7 (arquivo `a`→`h`), fixo.
Está correto para as brancas e de cabeça para baixo para as pretas.

- **Saída**: inverter a ordem de iteração quando `playerColor === 'Black'`. Desbloqueado desde
  2026-08-01: `getAssignedColor` já dá a cor confiável que faltava para decidir.

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

## Severidade baixa

### DT-11 — sem gate de CI, e sem formatter

Parcialmente resolvido em 2026-08-01: ao sair o `react-scripts`, o lint passou a ser explícito
(ESLint 9 flat config + typescript-eslint), e existem `npm run lint` e `npm run typecheck`. Falta:

- workflow de CI que rode `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:ci` e
  `npm run build` antes do merge — hoje nada garante que rodem;
- formatter (Prettier ou o formatador do ESLint), que continua não existindo.

### DT-13 — `SquareDto` de fallback é construído no componente

`ChessBoard` monta um `SquareDto` sintético quando a casa não vem no snapshot (`squareIndex.get`
falha). Isso mascara snapshot incompleto: em vez de aparecer erro, aparece tabuleiro plausível e
vazio. O backend sempre envia as 64 casas.

- **Saída**: se o snapshot não tem 64 casas, é erro de contrato — reportar em vez de preencher.

### DT-14 — `Login` mantém campos que o backend não aceita

O formulário de cadastro tem `dateBirth` e `phoneNumber` no estado, mas os inputs não são
renderizados (só e-mail, senha, confirmação e nome de usuário). `handleRegister` envia
`dateBirth` com valor default e `phoneNumber` vazio para um backend que não conhece nenhum dos dois.

- **Saída**: resolver junto com DT-03.
