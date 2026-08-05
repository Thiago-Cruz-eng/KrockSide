---
name: functional-map
description: Mapa dos 4 contextos do KrockSide (front-end React + TypeScript de xadrez multiplayer sobre o backend Hibrygame via REST e SignalR), com objetivo, evidência no código, dependências entre contextos e nível de confiança. Levantado em 2026-08-01 comparando src/ contra o backend real.
metadata:
  responsibility: "Mapa de identificação dos contextos do front-end, suas fronteiras e dependências. Índice para geração de skill e para o fluxo spec-driven; não detalha regra nem duplica as decisões transversais, que vivem no discovery-answers.md."
---

# Mapa funcional — KrockSide

Front-end do xadrez multiplayer. O recorte é por **contexto de interação**, não pela estrutura de
pastas: a organização física é por camada (`components`, `hooks`, `service`, `types`), e o mesmo
contexto aparece em três delas.

Todo o valor de negócio deste repositório é **apresentação e transporte**: a regra de xadrez, a
autoridade sobre jogada e a identidade do usuário vivem no backend (`../Hibrygame`). Um contexto
aqui que contenha regra própria de xadrez é, por definição, uma violação do Princípio I.

As decisões transversais (contrato, tipagem, camadas, testes, token) **não** se repetem aqui — vivem
no [`discovery-answers.md`](../context/discovery-answers.md).

**O que fica fora dos quatro blocos:** convenções técnicas transversais (padrões React/TS,
estratégia de teste, conexão SignalR, autenticação) são **skills técnicas**, não contextos.
`src/utils/reportWebVitals.ts` é boilerplate do CRA sem consumidor real.

---

## 1. Autenticação e sessão

**Objetivo.** Autenticar por e-mail/senha, guardar as credenciais por usuário, decidir se a sessão
é válida e anexar o token a todo request e ao handshake do hub. É a porta de entrada: sem ela, nem
lobby nem tabuleiro funcionam.

**Evidência no código.**
`src/components/Login.tsx` (login + cadastro no mesmo formulário alternado),
`src/hooks/useAuth.ts` (`readToken`, `decodeToken`, `isTokenValid`, `setTokens`, `logout`),
`src/service/Api.ts` (instância axios, interceptor de `Authorization`, storage por `userId`),
`src/types/auth.ts` (DTOs de login/refresh/cadastro/validação),
`src/service/userApi.ts` (`login`, `refresh`, `createUser`, `getUser`).
Testes: `Login.test.tsx`, `useAuth.test.ts`, `Api.test.ts`, `userApi.test.ts`,
`src/integration/auth-flow.test.tsx`.

**Depende de.** Backend REST. É consumido por *Lobby e sala* e por *Tabuleiro e jogada* (que leem
`useAuth`), e por *Transporte* (o `accessTokenFactory` do hub lê o mesmo storage).

**Confiança: média.** O caminho de **login** está correto e coberto por teste. Fora dele há três
divergências reais: rotas `create`, `get/{id}` e `refresh` não existem no backend (DT-02); o payload
e a resposta de cadastro são incompatíveis (DT-03); `DecodedToken` declara claims que o backend não
emite (DT-04). Não existe fluxo automático de refresh: `userApi.refresh` está implementado e
**nenhum código o chama** — token expirado simplesmente falha.

**Skill:** `autenticacao-e-sessao`.

---

## 2. Lobby e sala

**Objetivo.** Listar salas disponíveis, criar sala, escolher cor, entrar em uma sala, acompanhar
quem está dentro e navegar para o tabuleiro quando a partida pode começar.

**Evidência no código.**
`src/components/ChessLobby.tsx` (única tela do contexto, ~200 linhas: estado de salas, jogadores
por sala, cor selecionada e mensagem de erro), rota `/chess-lobby/:id` em `App.tsx`.
Invoca no hub: `GetAvailableRooms`, `GetPlayersInEachRoom`, `GetPlayersInRoom`, `CreateRoom`,
`JoinRoom`. Assina: `PlayerJoined`, `PlayerLeft`, `GameStarted`, `RoomFull`, `RoomNotFound`.
Chama no REST: `getUser`, `verifyValidation`, `getValidation`, `updateValidation`.
Testes: `tests-e2e/lobby.spec.ts` (E2E com backend mockado). **Não há teste unitário deste
componente** — é o maior vão de cobertura do repositório.

**Depende de.** *Autenticação e sessão* (exige `id` de rota + token válido) e *Transporte*.
É o **único** lugar que sabe a cor atribuída pelo servidor (`JoinRoomResponse.color`) — e hoje
descarta essa informação em vez de propagar para o tabuleiro.

**Confiança: baixa.** Três problemas estruturais: `handleJoinRoom` começa por `getUser`, que bate
em rota inexistente e aborta tudo (DT-02/DT-03); a navegação depende de checar
`GetPlayersInRoom === 2` logo após entrar, então o primeiro jogador nunca sai do lobby (DT-08); e o
seletor de cor não tem efeito real, porque o servidor atribui cor por ordem de chegada e ignora a
`pieceColor` gravada em `Validation` (DT-10). Além disso, vários caminhos de falha usam `return`
silencioso, sem mensagem para o usuário.

**Skill:** `lobby-e-sala`.

---

## 3. Tabuleiro e jogada

**Objetivo.** Renderizar as 64 casas a partir do snapshot do servidor, destacar movimentos
possíveis, capturar a intenção do jogador (clique ou arrastar) e enviar a jogada — exibindo a
recusa quando o servidor nega.

**Evidência no código.**
`src/components/ChessBoard.tsx` (grid 8×8, seleção, turno, cor do jogador),
`src/components/ChessSquare.tsx` (casa, imagem da peça, drag & drop, destaque),
`src/hooks/useChessGame.ts` (snapshot, destaque, `requestPossibleMoves`, `makeMove`, `refresh`,
`lastMoveError`),
`src/types/chess.ts` (DTOs do hub + `toAlgebraic`/`fileFromRow`/`rankFromColumn`),
`src/styles/{ChessBoard,ChessSquare,ChessPiece}.css`, imagens em `public/{color}-{type}.png`.
Rota `/chess-board/:roomName/:id`.
Testes: `ChessBoard.test.tsx`, `ChessSquare.test.tsx`, `useChessGame.test.tsx`.

**Depende de.** *Transporte* (todo estado vem do hub) e *Autenticação e sessão* (`useAuth` para a
identidade). **Deveria** depender de *Lobby e sala* para a cor do jogador, e é justamente essa
dependência que falta.

**Confiança: média para o render, baixa para a jogada.** O render do tabuleiro e o destaque estão
corretos e cobertos. A jogada está **bloqueada**: a cor do jogador é derivada do claim `role` do
JWT, resolve sempre para `'None'`, e todo quadrado recebe `disabled` (DT-01). O tabuleiro também
nunca é invertido para as pretas (DT-09) e monta uma casa sintética quando o snapshot está
incompleto, escondendo erro de contrato (DT-13).

**Não contém regra de xadrez** — e não pode passar a conter (Princípio I).

**Skill:** `tabuleiro-e-jogada`.

---

## 4. Transporte e contrato

**Objetivo.** Manter uma conexão SignalR viva e única para todo o app, oferecer `invoke`/`on`
tipados, concentrar a instância axios com o interceptor de token, e declarar em um lugar só o
formato de tudo o que atravessa a fronteira com o backend.

**Evidência no código.**
`src/hooks/useHubConnection.tsx` (`HubContext`, `HubProvider` montado em `src/index.tsx` acima do
`Router`, `defaultFactory` com `accessTokenFactory` + `withAutomaticReconnect`, `invoke` que recusa
quando não conectado, `on` que devolve função de desinscrição),
`src/service/Api.ts`, `src/types/{chess,auth}.ts`,
`src/test-utils/hub.tsx` (`createFakeHub`, `HubTestProvider`),
`src/mocks/` (MSW).

**Depende de.** Nada interno. **Todos** os outros contextos dependem dele.

**Confiança: alta.** É a parte melhor construída do repositório: provider único, cast de payload
concentrado na borda, `FakeHub` que permite testar hook e componente sem rede, `invoke` que falha
alto quando a conexão não está pronta. Dois pontos de atenção: o `useEffect` do provider depende de
`[url, factory]` (passar `factory` inline recria a conexão a cada render) e as respostas REST podem
vir com o envelope `$id`/`$values` do `ReferenceHandler.Preserve`, que nada trata (DT-06).

**Skills:** `conexao-signalr` e `contrato-do-backend`.

---

## Dependências entre contextos

```
                    ┌──────────────────────────┐
                    │ 4. Transporte e contrato │  ← todos dependem
                    └──────────┬───────────────┘
             ┌─────────────────┼──────────────────┐
             ▼                 ▼                  ▼
  1. Autenticação      2. Lobby e sala     3. Tabuleiro e jogada
     e sessão                 │                   ▲
             └────────────────┴───────────────────┘
                     (1 → 2 e 1 → 3 existem)
                     (2 → 3: a cor do servidor NÃO é propagada — DT-01)
```

Nenhum ciclo. A aresta faltante `2 → 3` é a causa raiz do bug que bloqueia o jogo.

## Ordem sugerida ao evoluir

1. **Contrato** — corrigir as rotas REST e os DTOs de cadastro/usuário (DT-02, DT-03, DT-04) e
   ajustar os mocks junto. Enquanto o mock espelha a rota errada, o teste esconde o bug.
2. **Cor do jogador** — propagar `JoinRoomResponse.color` do lobby para o tabuleiro (DT-01). É o
   que desbloqueia jogar.
3. **Lobby** — navegação por evento em vez de contagem (DT-08) e mensagem em todo caminho de falha
   (DT-10).
4. **Tabuleiro** — inverter para as pretas (DT-09) e cobrir `ChessLobby` com teste unitário.
5. **CI** — garantir que `tsc --noEmit`, `test:ci` e `build` rodem em PR (DT-11).
