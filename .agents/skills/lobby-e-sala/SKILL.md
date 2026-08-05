---
name: lobby-e-sala
description: >
  Lobby do KrockSide: listar e criar sala, escolher cor, entrar em sala, acompanhar jogadores por
  eventos PlayerJoined e PlayerLeft, e navegar para o tabuleiro. Cobre a sequência de validação
  antes do JoinRoom, o fato de a cor escolhida ser ignorada pelo servidor, a corrida na navegação e
  os returns silenciosos. Use ao mexer em ChessLobby, criar ou entrar em sala, tratar RoomFull e
  RoomNotFound, propagar a cor do jogador, ou investigar botão Entrar na Sala que não faz nada.
metadata:
  type: domain-skill
---

# Lobby e sala

> **Mantendo esta skill**
>
> Atualize quando o fluxo de entrada em sala mudar. Divergência entre skill e código sem decisão
> registrada é escalada para o humano.

## Visão geral do domínio

O lobby é a antessala da partida: mostra quais salas existem, quem está em cada uma, permite criar
sala e entrar em uma — e leva ao tabuleiro quando a partida pode começar.

É também o **único lugar do front que conhece a cor atribuída pelo servidor**
(`JoinRoomResponse.color`). Hoje essa informação é descartada, e é por isso que o tabuleiro não
consegue jogar (DT-01). Qualquer trabalho aqui deve considerar propagar essa cor adiante.

```
src/components/ChessLobby.tsx     única tela do contexto (~200 linhas)
rota: /chess-lobby/:id            id = Guid do usuário
```

Invoca no hub: `GetAvailableRooms`, `GetPlayersInEachRoom`, `GetPlayersInRoom`, `CreateRoom`,
`JoinRoom`. Assina: `PlayerJoined`, `PlayerLeft`, `GameStarted`, `RoomFull`, `RoomNotFound`.
Chama no REST: `getUser`, `verifyValidation`, `getValidation`, `updateValidation`.

**Não há teste unitário deste componente** — só o E2E `tests-e2e/lobby.spec.ts`, que valida a
chegada no lobby, não o fluxo de entrada em sala. É o maior vão de cobertura do repositório.

## Estado

| Estado | Papel |
|---|---|
| `isNewGame` | alterna entre "criar sala" e "listar salas" |
| `roomName` | input do nome da sala nova |
| `rooms` | `string[]` de `GetAvailableRooms` |
| `playersByRoom` | `Record<room, PlayerInRoom[]>`, atualizado por evento |
| `selectedColor` | `'White' \| 'Black' \| ''` — escolha local do usuário |
| `errorMessage` | mensagem exibida em `role="alert"` |

Carga inicial (efeito com `[state, on, loadRooms, loadPlayersInRoom]`), quando o hub vira
`Connected`:

1. `GetAvailableRooms` → `rooms`;
2. `GetPlayersInEachRoom` → `playersByRoom`. Esse método devolve **apenas nomes**, então o
   componente preenche `color: 'None'` para cada jogador;
3. assina os cinco eventos e desinscreve todos no cleanup.

`PlayerJoined`/`PlayerLeft` substituem a lista da sala pela `players` do payload — essa **sim** vem
com cor. Ou seja: a cor aparece na UI depois do primeiro evento, não na carga inicial.

## Fluxo de `handleJoinRoom(room)`

Ordem real do código:

1. valida sessão: `!id || !decoded || !isValid` → `"Sessão inválida. Faça login novamente."`;
2. valida cor selecionada → `"Selecione uma cor antes de entrar."`;
3. `userApi.getUser(id)` — **`return` silencioso** se `!user.userName`;
4. `userApi.verifyValidation(decoded.sub)` — **`return` silencioso** se falso;
5. `userApi.getValidation(decoded.sub)`; se existir, `userApi.updateValidation(validation.id, {...})`
   com a cor escolhida em minúsculas — **`return` silencioso** se não atualizar;
6. `invoke<JoinRoomResponse>('JoinRoom', user.userName, room)`; se `!joinResult.room` →
   `"Falha ao entrar na sala."`;
7. `invoke<number>('GetPlayersInRoom', room)`; navega para `/chess-board/{room}/{id}` **só se for
   exatamente 2**.

Cinco problemas nesse fluxo, todos catalogados:

- **passo 3 sempre falha** — `getUser` chama `get/{id}`, rota que não existe no backend
  (`/users/{id}`), então a função aborta em 404 antes de tudo e o `catch` externo mostra
  `"Erro ao entrar na sala."` (DT-02/DT-03);
- **`user.userName` não existe** no contrato do backend (que devolve `name`), então mesmo com a rota
  corrigida o `return` silencioso do passo 3 dispara (DT-03);
- **três `return` silenciosos** (passos 3, 4, 5): o usuário clica e nada acontece, sem mensagem.
  Toda saída de erro deve passar por `setErrorMessage`;
- **a cor escolhida não tem efeito** — o servidor atribui cor por ordem de chegada em
  `TryAssignColor` e **ignora** a `pieceColor` gravada em `Validation`. A UI promete uma escolha que
  não existe (DT-10);
- **o passo 7 é uma corrida** — o primeiro jogador a entrar vê `1` e fica preso no lobby; só sai se
  recarregar depois do segundo entrar. Os eventos `PlayerJoined` e `GameStarted` já estão assinados,
  e o handler de `GameStarted` está **vazio**, com um comentário admitindo o problema (DT-08).

### A correção certa da navegação

Navegue **a partir do evento**, não de consulta pós-ação:

- `PlayerJoined` com `payload.players.length === 2` e `payload.room === salaEmQueEntrei`; ou
- `GameStarted` (que o backend emite para o grupo quando `StartGame` roda).

Guarde a sala em que este cliente entrou (e a cor recebida em `joinResult.color`) para poder decidir
no handler.

## `createRoom`

```ts
const result = await invoke<CreateRoomResponse>('CreateRoom', roomName);
if (result.alreadyExisted) setErrorMessage('Sala já existe.');
setRooms(prev => prev.includes(result.room) ? prev : [...prev, result.room]);
```

- Ignora nome vazio (`!roomName.trim()`), mas **não** normaliza (espaço no meio, caixa, acento
  passam direto). O nome é a chave da sala no dicionário do backend: `"Sala 1"` e `"sala 1"` são
  salas diferentes.
- **`alreadyExisted` não significa "a sala já existia"** e sim "a sala tem jogador" — defeito
  conhecido do backend. A mensagem `"Sala já existe."` é enganosa em parte dos casos.
- A sala é adicionada à lista local otimisticamente; não há recarga de `GetAvailableRooms`.

## Eventos e mensagens

| Evento | Tratamento atual |
|---|---|
| `PlayerJoined` | substitui `playersByRoom[room]` pela lista com cor |
| `PlayerLeft` | idem (payload pode vir **sem** `player` quando é `LeaveRoom`) |
| `GameStarted` | **handler vazio** — deveria navegar (DT-08) |
| `RoomFull` | `"Sala cheia: {msg}"` |
| `RoomNotFound` | `"Sala não encontrada: {sala}"` |

`RoomFull` e `RoomNotFound` são enviados **para quem chamou** `JoinRoom` (`Clients.Caller`), então
chegam junto com o retorno vazio do `JoinRoom` — o usuário vê a mensagem do evento **e** a
`"Falha ao entrar na sala."` do retorno. Duas mensagens para o mesmo problema: ao mexer aqui,
escolha uma.

## Restrições conhecidas

- Botão "Entrar na Sala" fica `disabled` quando a sala tem 2 jogadores **ou** nenhuma cor foi
  escolhida. Como a cor não tem efeito real, essa exigência é fricção sem função (DT-10).
- Não há saída de sala pela UI: `LeaveRoom` existe no hub e **nenhum componente o chama**. Sair é
  fechar a aba (o backend trata via `OnDisconnectedAsync`).
- Sala vazia nunca é removida no backend: a lista cresce indefinidamente.
- Não há paginação, busca nem limite de salas.
- O seletor de cor não é por sala: `selectedColor` é global do componente, mas o botão de cor é
  renderizado **dentro de cada `<li>`** de sala — visualmente sugere escolha por sala, e o estado é
  compartilhado.
- Reconectar gera `ConnectionId` novo: o backend cria um slot novo, então reentrar numa sala que já
  tem dois jogadores é recusado com `RoomFull`.

## Ao evoluir este contexto

Ordem que resolve mais com menos risco:

1. corrigir `getUser` (rota + campo `name`) — desbloqueia o fluxo inteiro;
2. trocar todo `return` silencioso por `setErrorMessage`;
3. propagar `joinResult.color` para o tabuleiro (resolve DT-01, o bloqueio do jogo);
4. navegar por evento em vez de contagem;
5. decidir o que fazer com o seletor de cor: remover, ou exibir a cor **recebida** em vez da
   escolhida (depende de D-03, a decisão sobre a coleção `Validation`).
