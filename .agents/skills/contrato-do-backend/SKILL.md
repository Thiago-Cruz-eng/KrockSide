---
name: contrato-do-backend
description: >
  Contrato real entre o KrockSide e o backend Hibrygame: rotas REST que existem de fato, os dez
  métodos e seis eventos do hub /chesshub, formato de BoardSnapshot/SquareDto/PieceDto, claims que
  o JWT emite, envelope $id/$values do ReferenceHandler.Preserve nas respostas REST, e as rotas e
  DTOs deste repositório que estão divergentes. Use antes de criar ou alterar qualquer chamada ao
  backend, mexer em src/service/userApi.ts, src/types/auth.ts, src/types/chess.ts, ou investigar
  404, campo undefined e payload inesperado.
metadata:
  type: technical-skill
---

# Contrato do backend

> **Mantendo esta skill**
>
> A fonte de verdade é `docs/FRONTEND_CHANGES.md` **do repositório `../Hibrygame`**. Ao encontrar
> divergência entre esta skill e o backend, **o backend vence**: corrija a skill. Divergência entre
> esta skill e o código deste repositório é débito — registre em `docs/debito-tecnico.md`.

## Visão geral

Dois canais, um servidor:

- **REST** via `axios` (`src/service/Api.ts` + `src/service/userApi.ts`) — autenticação, usuário,
  endpoints de validação;
- **SignalR** via `@microsoft/signalr` (`src/hooks/useHubConnection.tsx`) — hub `/chesshub`, onde a
  partida acontece.

Base configurável: `REACT_APP_API_BASE_URL` (default `https://localhost:5001/`) e
`REACT_APP_HUB_URL` (default `https://localhost:5001/chesshub`).

**Casing:** o backend serializa em **camelCase** nos dois canais. Os tipos de `src/types/` são
camelCase — mantenha assim. As strings de enum, porém, vêm em **PascalCase**
(`"White"`, `"Pawn"`) porque o backend usa `.ToString()` do enum. Nunca espere `"white"`/`"pawn"`.

## REST — o que existe de fato

| Método | Rota real do backend | Autorização | Corpo / retorno |
|---|---|---|---|
| POST | `/login` | anônimo | `{ email, password }` → `LoginResponse` |
| POST | `/refresh-token` | anônimo | `{ userId, refreshToken }` → `RefreshTokenResponse` |
| POST | `/users` | anônimo | `{ name, email, password, passwordConfirmation, role, createdBy, assignments }` → `{ success, message, userId }` |
| GET | `/users/{id}` | `Role:Player` | → `{ id, name, email, role, mustChangePassword, assignments }` |
| PUT | `/users/{id}` | `Role:TeamLeader` | → `{ success, message }` |
| DELETE | `/users/{id}` | `Role:Admin` | → `{ success, message }` |
| POST | `/users/change-password` | `Role:Player` | `{ userId, currentPassword, newPassword, modifiedBy }` → `{ success, message }` |
| POST | `/validation/verify` | `Role:Player` | `{ userId }` → `{ valid }` |
| POST | `/validation/get` | `Role:Player` | `{ userId }` → `GetValidationResponse` |
| POST | `/validation/update/{id}` | `Role:Player` | `{ userId, room, pieceColor, userEmail }` → `{ updated }` |
| POST | `/validation/can-move` | `Role:Player` | `{ userId, room, pieceColor, userEmail, day }` → `{ canMove }` |

### ⚠️ O que `userApi.ts` chama e não existe

| `userApi` chama | Deveria ser | Efeito |
|---|---|---|
| `POST create` | `POST /users` | 404 — cadastro nunca funcionou (DT-02) |
| `GET get/{id}` | `GET /users/{id}` | 404 — `handleJoinRoom` aborta no primeiro passo (DT-02) |
| `POST refresh` | `POST /refresh-token` | 404 — refresh nunca funcionou (DT-02) |

`POST login` e as quatro rotas de `validation/` estão corretas.

**Antes de escrever uma chamada nova, confira esta tabela.** Não copie o padrão de rota de
`userApi.ts`: três das sete estão erradas.

### Regras de todos os endpoints REST

- **Autorização por header:** `Authorization: Bearer {accessToken}` — aplicado pelo interceptor de
  `createApi`. Nenhum token em query string ou path.
- **Defesa em profundidade:** os endpoints de `validation/` e `change-password` recebem `userId` no
  corpo e o backend compara com o claim `sub` do token. Divergência → **403**. Sempre envie
  `decoded.sub`, nunca um id digitado ou de outra origem.
- **Falha não é exceção:** o corpo vem sempre com `success: false` + `message`, com status variável
  (`400`/`401`/`403`/`404`). **Decida pelo `success` do corpo**, não só pelo status. A exceção é
  `validation/get`, que pode devolver 404 (tratado em `userApi.getValidation`, que retorna `null`) —
  e hoje pode devolver **500** por um defeito do backend quando não encontra.
- **`ReferenceHandler.Preserve`:** o backend serializa controllers com esse handler, então a resposta
  pode conter `$id`, referências repetidas como `{"$ref":"1"}` e listas como
  `{"$id":"2","$values":[...]}`. Nada no front trata isso (DT-06). Campo plano funciona; campo de
  lista (ex.: `assignments`) chega em formato inesperado. **Isso não vale para SignalR.**

## Hub `/chesshub` — os dez métodos

Autenticação no handshake via `accessTokenFactory` (query string `?access_token=`), aceita pelo
backend **apenas** para o path `/chesshub`. Requer papel ≥ `"jogador"`.

| Método | Argumentos | Retorno |
|---|---|---|
| `CreateRoom` | `room: string` | `CreateRoomResponse { success, message?, room, alreadyExisted }` — `success: false` para nome fora de `^[\p{L}\p{N} _-]{1,64}$` ou teto de salas (2026-09-23) |
| `GetAvailableRooms` | — | `string[]` (salas não cheias e não finalizadas) |
| `GetPlayersInRoom` | `room` | `number` |
| `GetPlayersInEachRoom` | — | `Record<string, string[]>` (nomes, sem cor) |
| `JoinRoom` | `playerName, room` | `JoinRoomResponse { connectionId, player, room, color }` |
| `StartGame` | `room` | `StartGameResponse { success, message?, snapshot? }` |
| `GetBoardSnapshot` | `room` | `BoardSnapshot \| null` |
| `GetPossibleMoves` | `room, from` | `PossibleMovesResponse { success, message?, from?, moves }` |
| `MakeMove` | `room, from, to` | `MakeMoveResponse { success, message?, from?, to?, nextTurn?, snapshot? }` |
| `LeaveRoom` | `room` | `void` |

`from`/`to` são **algébricos** (`"e2"`). Maiúscula é aceita; fora de `a1..h8` devolve
`success: false`.

Detalhes que economizam depuração:

- **`JoinRoom` é o único lugar que informa a cor do jogador.** Em falha (sala inexistente ou cheia)
  devolve objeto vazio (`{ connectionId: null, player: null, room: null, color: null }`) **e**
  emite `RoomNotFound`/`RoomFull` para quem chamou. Cheque `result.room` ou `result.color`.
- **`CreateRoom.alreadyExisted` não significa "a sala já existia"** e sim "a sala tem jogador" — é
  um defeito conhecido do backend. Não construa lógica confiando na semântica do nome.
- **`GetPlayersInEachRoom` devolve só nomes**, sem cor, ao contrário de `PlayerJoined.players`. Por
  isso `ChessLobby` preenche `color: 'None'` ao montar o estado inicial.
- **`StartGame` é idempotente no servidor** (`if (Started) return;`), mas reemite `GameStarted` para
  o grupo a cada chamada.
- **`GetPossibleMoves` não exige turno nem posse** — só que o jogo tenha começado. É intencional:
  é dica de UI, não autorização.

## Hub — os seis eventos

| Evento | Payload |
|---|---|
| `PlayerJoined` | `{ room, player, color, players: [{ name, color }] }` |
| `PlayerLeft` | `{ room, connectionId, player?, players: [{ name, color }] }` |
| `RoomFull` | `string` (mensagem) |
| `RoomNotFound` | `string` (nome da sala) |
| `GameStarted` | `BoardSnapshot` |
| `BoardChanged` | `{ from, to, byColor, nextTurn, snapshot }` |

`PlayerLeft` vem sem `player` quando a origem é `LeaveRoom`, e com `player` quando é desconexão —
trate a ausência.

Erro de invocação **não** gera evento: volta no retorno, com `success: false` + `message`.

## Formato do tabuleiro

```ts
BoardSnapshot { room, currentTurn, started, finished, squares }   // squares tem SEMPRE 64 itens
SquareDto     { file, rank, algebraic, row, column, squareColor, piece }
PieceDto      { type, color, isInCheckState }
```

Ordem de `squares`: varredura de `Positions[row, column]` do backend. `finished` **nunca** vira
`true` hoje (o backend não encerra partida). `currentTurn` começa em `"White"`.

Conversão de coordenada (helpers em `src/types/chess.ts` — use-os, não reimplemente):

```
file = 'a' + row        rank = 8 - column
```

`column = 7` é o rank 1 (brancas); `column = 0` é o rank 8 (pretas). O eixo `column` é **invertido**
em relação ao rank — errar isso é o bug clássico deste par de repositórios.

## As nove mensagens de recusa de `MakeMove`

O backend revalida tudo, nesta ordem, e devolve `success: false` com uma destas `message`:

1. `"Game not started."` · 2. `"Game already finished."` · 3. `"You are not in this room."` ·
4. `"Not your turn."` · 5. `"Invalid square notation."` · 6. `"No piece on '{from}'."` ·
7. `"That piece is not yours."` · 8. `"Illegal move."` ·
9. `"Move would leave king in check."`

Exiba a `message` como veio (o backend responde em inglês). Não traduza nem substitua por texto
genérico: a mensagem exata é a única pista que o usuário tem. `useChessGame` já guarda em
`lastMoveError`.

## Claims do JWT

O backend emite: `sub` (id do usuário), `email`, `name`, `jti`, e o papel via
`new Claim(ClaimTypes.Role, ...)` — que no payload aparece na chave longa
`http://schemas.microsoft.com/ws/2008/06/identity/claims/role`, **não** como `role`.

⚠️ `src/types/auth.ts` declara `emailAddress` e `role`: os dois são sempre `undefined` (DT-04).
E o papel, quando lido, é permissão (`"jogador"`, `"adm"`, …), **nunca** cor de peça — usá-lo para
cor é o bug DT-01.

Access token: HS256, 60 min, `ClockSkew` zero (expira exatamente). Refresh token: 64 bytes base64,
**rotativo** — cada refresh invalida o anterior; reusar o antigo devolve falha. `userApi.refresh`
existe e **nenhum código o chama**.

## Ao mudar contrato

1. Confirme o estado real no backend (`docs/FRONTEND_CHANGES.md` de `../Hibrygame`).
2. Ajuste `src/types/` para refletir o que **existe**, não o que se desejava.
3. Se a mudança precisa acontecer no backend, registre em `BACKEND_CHANGES.md` deste repositório
   com contrato antigo, novo e motivo — e marque no código que o cliente aponta para algo pendente.
4. **Atualize os mocks no mesmo commit**: `src/mocks/handlers.ts` e `tests-e2e/*.spec.ts` hoje
   espelham as rotas erradas, e é por isso que a suíte não denuncia DT-02. Mock que confirma o bug é
   pior que ausência de teste.
5. A seção "Hub method names (unchanged)" de `BACKEND_CHANGES.md` está **desatualizada** (DT-05):
   lista `GetAvailableRoom`, `SendPossiblesMoves`, `BoardChange`, `GameWillStart`, que não existem.
   Use a tabela desta skill.
