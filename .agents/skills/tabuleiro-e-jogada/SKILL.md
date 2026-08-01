---
name: tabuleiro-e-jogada
description: >
  Tabuleiro e jogada do KrockSide: render do grid 8x8 a partir do snapshot do servidor, os três
  sistemas de coordenada e o eixo column invertido, seleção por clique e por arrastar, destaque de
  movimentos possíveis, estado do useChessGame, exibição de recusa do servidor, e o bug que hoje
  bloqueia toda jogada (cor lida do claim role). Use ao mexer em ChessBoard, ChessSquare,
  useChessGame, render de peça, destaque, turno, ou ao investigar quadrado que não responde a
  clique.
metadata:
  type: domain-skill
---

# Tabuleiro e jogada

> **Mantendo esta skill**
>
> Atualize quando o comportamento do tabuleiro mudar de propósito. Divergência entre skill e código
> sem decisão registrada é escalada para o humano.

## Visão geral do domínio

Renderizar o tabuleiro que o **servidor** descreve, capturar a intenção do jogador e enviá-la —
exibindo a recusa quando o servidor nega. Não há regra de xadrez aqui e não pode haver
(Princípio I).

```
src/hooks/useChessGame.ts       estado da partida: snapshot, destaque, erro de jogada
src/components/ChessBoard.tsx   grid 8x8, seleção, turno, cor do jogador
src/components/ChessSquare.tsx  uma casa: cor, peça, destaque, clique, drag & drop
src/types/chess.ts              DTOs + toAlgebraic / fileFromRow / rankFromColumn
src/styles/{ChessBoard,ChessSquare,ChessPiece}.css
public/{color}-{type}.png       12 imagens: black-king.png, white-pawn.png, ...
```

Rota: `/chess-board/:roomName/:id`.

## ⚠️ Estado atual: a jogada está bloqueada

`ChessBoard` deriva a cor do jogador do claim `role` do JWT:

```ts
function selfColor(decodedRole?: string): Color {
  if (decodedRole === 'white') return 'White';
  if (decodedRole === 'black') return 'Black';
  return 'None';
}
```

O claim `role` carrega **papel de permissão** (`"jogador"`, `"adm"`, …), e nem sob a chave `role` —
o backend emite na chave longa de `ClaimTypes.Role`. Resultado: `playerColor` é sempre `'None'`,
`isMyTurn` é sempre `false`, e **todos os 64 `ChessSquare` recebem `disabled={true}`**: clique e
drop são ignorados sem nenhuma mensagem.

A cor correta vem do servidor: `JoinRoomResponse.color` (retorno de `JoinRoom`, no lobby) e
`PlayerJoinedEvent.color`. Ver DT-01 em `docs/debito-tecnico.md`.

**Ao trabalhar aqui:** não construa em cima de `selfColor`. Se a task precisa de cor confiável,
resolva DT-01 primeiro (propagar a cor do lobby) ou trate explicitamente o estado "cor
desconhecida" — mostrando "aguardando" em vez de desabilitar tudo em silêncio.

## Os três sistemas de coordenada

Cada casa carrega três representações, todas vindas do servidor no `SquareDto`:

| Sistema | Campos | Uso |
|---|---|---|
| Algébrico | `algebraic` (`"e4"`) | **toda** comunicação com o backend e chave de `Map`/`Set` |
| File/rank | `file` (`"e"`), `rank` (`4`) | exibição para humano |
| Row/column | `row`, `column` (0..7) | **apenas** layout do grid |

Conversão (helpers em `src/types/chess.ts` — use-os, nunca reimplemente inline):

```
file = 'a' + row          row    = file - 'a'
rank = 8 - column         column = 8 - rank
```

**O eixo `column` é invertido em relação ao rank.** `column = 0` é o rank 8 (pretas);
`column = 7` é o rank 1 (brancas). E `row` é o **arquivo** (`a`..`h`), não a linha — o nome engana.
Errar isso é o bug clássico deste par de repositórios.

## Layout do grid

```tsx
{Array.from({ length: 8 }).map((_, col) => (      // linha visual: col 0 → rank 8 (topo)
  <div className="row">
    {Array.from({ length: 8 }).map((_, row) => {  // coluna visual: row 0 → arquivo 'a'
      const algebraic = toAlgebraic(row, col);
```

O laço **externo** é `col` (rank, de 8 para 1) e o **interno** é `row` (arquivo, de `a` para `h`).
Está correto para as brancas e de cabeça para baixo para as pretas — não há inversão de perspectiva
(DT-09).

`squareIndex` é um `Map<algebraic, SquareDto>` memoizado sobre `squares`, e o grid busca cada casa
por chave algébrica. Quando a casa **não** está no snapshot, o componente monta um `SquareDto`
sintético — o que mascara snapshot incompleto (DT-13). O backend sempre envia 64 casas: ausência é
erro de contrato, não caso normal.

## `useChessGame`

```ts
const {
  snapshot, squares, currentTurn, highlighted, loading, error, lastMoveError,
  requestPossibleMoves, makeMove, clearHighlights, refresh,
} = useChessGame(roomName);
```

| Campo | Semântica |
|---|---|
| `snapshot` | último `BoardSnapshot` recebido; `null` até o primeiro |
| `squares` | `snapshot?.squares ?? []` |
| `currentTurn` | `snapshot?.currentTurn ?? 'None'` |
| `highlighted` | `Set<string>` de algébricos destacados |
| `loading` | `true` até o primeiro snapshot ou erro |
| `error` | falha de conexão/`StartGame`; renderiza tela de erro |
| `lastMoveError` | `message` da última recusa do servidor; renderiza `role="alert"` |

Ciclo de vida (efeito com `[state, start, on]`):

1. quando o hub vira `Connected`, chama **`StartGame`** — todo cliente chama, não só quem criou a
   sala (DT-07). O correto seria `GetBoardSnapshot` via `refresh`, que existe e **não tem nenhum
   consumidor**;
2. assina `BoardChanged` → substitui o snapshot e **limpa o destaque**;
3. assina `GameStarted` → substitui o snapshot e encerra o `loading`;
4. desinscreve as duas no cleanup.

`requestPossibleMoves(from)` invoca `GetPossibleMoves` e, em sucesso, preenche `highlighted` com os
`algebraic` de `moves`; em falha, limpa o destaque e grava `lastMoveError`.

`makeMove(from, to)` invoca `MakeMove` e, em sucesso, aplica `result.snapshot`, limpa o destaque e
zera `lastMoveError`; em falha, grava `lastMoveError` e **não toca no tabuleiro**.

**Nunca atualize o tabuleiro antes da resposta** (Princípio I): o estado novo vem sempre de
`result.snapshot` ou do evento `BoardChanged`.

## Interação: clique e arrastar

`ChessBoard.handleSelect(algebraic, piece)` implementa a máquina de dois toques:

1. **já existe seleção e o destino é outra casa** → chama `makeMove(selected, algebraic)`, limpa a
   seleção e, se falhou, limpa o destaque;
2. **não há peça, ou a peça não é da minha cor** → limpa seleção e destaque (clique inócuo);
3. **peça minha** → marca como selecionada e pede `requestPossibleMoves(algebraic)`.

Note que o passo 1 vem **antes** da checagem de posse: com uma peça selecionada, clicar em
qualquer casa tenta a jogada — e o servidor decide. Isso é correto pelo Princípio I.

`ChessSquare` cuida do arrastar:

- `onDragStart` grava a origem em `dataTransfer` com a chave `'from'`;
- `onDragOver` chama `preventDefault` (sem isso o drop nunca dispara);
- `onDrop` lê `'from'`, ignora quando vazio ou igual ao destino, e chama `onDropPiece(from, to)`;
- `disabled` bloqueia clique e drop, e desliga `draggable` na imagem.

## Render da peça

```tsx
src={`${process.env.PUBLIC_URL}/${piece.color.toLowerCase()}-${piece.type.toLowerCase()}.png`}
alt={`${piece.color} ${piece.type}`}
```

- Os nomes vêm de `Color`/`PieceType` em **PascalCase** (`"White"`, `"Pawn"`), passados por
  `toLowerCase()` para casar com os arquivos em `public/`. Peça nova exige imagem
  `{cor}-{tipo}.png` — sem ela, o `img` quebra silenciosamente.
- `piece.type !== 'None'` é checado antes de renderizar: `"None"` é valor legítimo do backend para
  casa vazia mal-serializada.
- `getSizeClass` mapeia tipo → classe de tamanho (`small` para peão, `large` para rei). É estética;
  classe nova precisa de CSS em `ChessPiece.css`.
- `alt` descritivo é requisito de acessibilidade **e** o seletor usado nos testes — não remova.

## Seletores estáveis

Já existem e os testes dependem deles:

| Seletor | Onde |
|---|---|
| `data-testid="square-{algebraic}"` | `ChessSquare` |
| `data-algebraic="{algebraic}"` | `ChessSquare` |
| `data-testid="current-turn"` | `ChessBoard` |
| `data-testid="player-color"` | `ChessBoard` |
| `role="alert"` | erro de conexão e `lastMoveError` |
| `alt="{Color} {Type}"` | imagem da peça |

Classe CSS (`highlighted`, `light`, `dark`) é estilo — **não** use como seletor de teste.

## Restrições e armadilhas conhecidas

- **Cor do jogador quebrada (DT-01)** — descrito acima. É o bloqueio principal.
- **Sem inversão para as pretas (DT-09)** — depende de DT-01 para ter cor confiável.
- **Casa sintética esconde snapshot incompleto (DT-13)**.
- **`StartGame` chamado por todo cliente (DT-07)** e `refresh` sem consumidor.
- **`ChessBoard` não valida sessão** — abrir a URL sem token renderiza a tela e falha nas chamadas
  do hub.
- **Sem fim de partida:** `snapshot.finished` nunca vira `true` (o backend não encerra partida) e
  não há xeque-mate, empate, promoção, roque nem en passant. `isInCheckState` chega no `PieceDto` e
  **não é usado** no render — destacar o rei em xeque é feature disponível de graça.
- **Sem histórico de jogadas** e sem relógio.
- **Peça capturada** não é exibida em nenhum lugar: o snapshot só descreve o tabuleiro atual.
