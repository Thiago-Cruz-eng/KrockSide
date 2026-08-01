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

> ⚠️ **Não foi possível rodar a suíte** durante este levantamento: neste ambiente o Node falha com
> `EPERM: lstat 'C:\Users\dgs-admin\AppData'` ao resolver o diretório de instalação do npm. Nenhuma
> contagem de teste aqui é verificada — rode `npm run test:ci` antes de confiar em qualquer
> baseline. Este item é ambiental, não do repositório.

## Severidade alta — o jogo não funciona

### DT-01 — a cor do jogador é lida do claim `role`, então nenhuma jogada é possível

`ChessBoard.tsx` resolve a cor assim:

```ts
function selfColor(decodedRole?: string): Color {
  if (decodedRole === 'white') return 'White';
  if (decodedRole === 'black') return 'Black';
  return 'None';
}
const playerColor = selfColor(decoded?.role);
const isMyTurn = playerColor !== 'None' && playerColor === currentTurn;
```

Três problemas encadeados:

1. o claim `role` do JWT carrega **papel de permissão** do backend (`"jogador"`,
   `"jogador principal"`, `"lider de time"`, `"adm"`, `"super adm"`), nunca `"white"`/`"black"`;
2. o backend emite o papel com `new Claim(ClaimTypes.Role, ...)`, que no payload do JWT vira a
   chave longa `http://schemas.microsoft.com/ws/2008/06/identity/claims/role` — então
   `decoded.role` é `undefined` de qualquer forma;
3. logo `playerColor === 'None'` sempre, `isMyTurn` é sempre `false`, e `ChessSquare` recebe
   `disabled={true}` em **todos** os 64 quadrados: clique e drop são ignorados.

A cor correta vem do servidor, em dois lugares: `JoinRoomResponse.color` (retorno de `JoinRoom`) e
`PlayerJoinedEvent.color`/`players[].color`.

- **Arquivos**: `src/components/ChessBoard.tsx`, `src/components/ChessLobby.tsx`,
  `src/hooks/useAuth.ts`, `src/types/auth.ts`
- **Saída**: propagar a cor do `JoinRoom` do lobby para o tabuleiro (contexto, estado de rota ou
  `sessionStorage` por sala) e remover `selfColor`. Enquanto não houver cor confirmada pelo
  servidor, o tabuleiro deve mostrar estado "aguardando" — não `disabled` silencioso.
  Cobre o Princípio I item 4.

### DT-02 — quatro rotas REST divergem do backend real

`src/service/userApi.ts` chama rotas que **não existem** no `UserController` do backend:

| `userApi` chama | Backend expõe | Situação |
|---|---|---|
| `POST create` | `POST /users` | ❌ 404 |
| `GET get/{id}` | `GET /users/{id}` | ❌ 404 |
| `POST refresh` | `POST /refresh-token` | ❌ 404 |
| `POST login` | `POST /login` | ✅ |
| `POST validation/{verify,get,update/{id},can-move}` | idem | ✅ |

Consequência prática: **cadastro e refresh nunca funcionaram**, e `ChessLobby.handleJoinRoom` chama
`userApi.getUser(id)` como primeira ação — ou seja, entrar em sala falha em 404 antes de qualquer
outra coisa (o `catch` mostra "Erro ao entrar na sala."). Os testes passam porque `msw` e
`page.route` mockam justamente as rotas erradas (`**/login`, `**/get/**`).

- **Arquivos**: `src/service/userApi.ts`, `src/mocks/handlers.ts`, `tests-e2e/*.spec.ts`
- **Saída**: corrigir as três rotas em `userApi`, e atualizar os mocks **juntos** — mock que
  espelha a rota errada é o que esconde o bug.

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

### DT-08 — navegação para o tabuleiro depende de corrida no lobby

`handleJoinRoom` navega só quando `GetPlayersInRoom(room) === 2`, checado **imediatamente após** o
próprio `JoinRoom`. O primeiro jogador a entrar vê `1` e fica preso no lobby: ele só sai de lá se
recarregar e entrar de novo depois do segundo. O evento `PlayerJoined` já é assinado, mas o handler
só atualiza a lista de jogadores; o handler de `GameStarted` está vazio, com um comentário
admitindo o problema.

- **Arquivo**: `src/components/ChessLobby.tsx`
- **Saída**: navegar a partir do evento — `PlayerJoined` com `players.length === 2`, ou
  `GameStarted` — em vez de consultar contagem logo após entrar.

### DT-09 — o tabuleiro nunca é invertido para as pretas

`ChessBoard` monta o grid com `col` de 0→7 (rank 8 no topo) e `row` de 0→7 (arquivo `a`→`h`), fixo.
Está correto para as brancas e de cabeça para baixo para as pretas.

- **Saída**: inverter a ordem de iteração quando `playerColor === 'Black'`. Depende de DT-01 estar
  resolvido (hoje não há cor confiável para decidir).

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

### DT-11 — sem gate automatizado de lint, tipo e teste

Não há workflow de CI, ESLint próprio, Prettier nem checagem de tipo separada. `npm run build`
falha em erro de tipo, mas ninguém garante que ele rode antes do merge.

- **Saída**: `.github/workflows/ci.yml` com `npm ci`, `npx tsc --noEmit`, `npm run test:ci` e
  `npm run build` (foi adicionado junto com este harness — confirme que roda verde na primeira
  execução real, já que não foi possível rodar localmente).

### DT-12 — MSW v1 (API legada)

`src/mocks/handlers.ts` usa `rest` de `msw@1`. A v2 troca para `http` e muda a assinatura dos
resolvers. Não é urgente, mas a v1 não recebe mais correção.

- **Saída**: migração só quando houver motivo (bug ou dependência transitiva). Não é ganho por si.

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
