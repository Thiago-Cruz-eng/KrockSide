/**
 * O contrato de xadrez com o backend, espelhado em TypeScript.
 *
 * **Este arquivo é declaração, não implementação.** Divergir do que o servidor realmente manda não
 * quebra a compilação — quebra em runtime, com campo `undefined` e sintoma distante da causa. A fonte
 * de verdade é `docs/FRONTEND_CHANGES.md` **do repositório `../Hibrygame`**, não este arquivo e não a
 * memória de ninguém.
 *
 * Os nomes vêm em camelCase porque o backend serializa assim tanto no MVC quanto no SignalR, ainda
 * que as classes em C# sejam PascalCase.
 *
 * No fim do arquivo estão os três helpers de coordenada. **Use-os sempre** — a conversão é
 * contraintuitiva e reimplementá-la inline é a forma mais comum de espelhar o tabuleiro por acidente.
 */

/**
 * Lado do tabuleiro, ou ausência de lado.
 *
 * `'None'` aparece em três situações distintas que vale saber distinguir: casa vazia (em
 * `PieceDto.color` nunca ocorre, mas em `piece: null` sim), partida sem turno definido, e **jogador
 * sem cor atribuída** — este último significa que `JoinRoom` ainda não respondeu ou que a sessão não
 * tem assento na sala, e é o que desabilita o tabuleiro.
 */
export type Color = 'White' | 'Black' | 'None';

export type PieceType =
  | 'Pawn'
  | 'Knight'
  | 'Bishop'
  | 'Rook'
  | 'Queen'
  | 'King'
  | 'None';

export interface PieceDto {
  type: PieceType;
  color: Color;
  isInCheckState: boolean;
}

export interface SquareDto {
  file: string;
  rank: number;
  algebraic: string;
  row: number;
  column: number;
  squareColor: Color;
  piece: PieceDto | null;
}

/** Situação da partida na vez de `currentTurn`. */
export type GameOutcome = 'InProgress' | 'Checkmate' | 'Stalemate';

export interface BoardSnapshot {
  room: string;
  currentTurn: Color;
  started: boolean;
  finished: boolean;
  /** Ausente em respostas antigas do servidor; trate como 'InProgress'. */
  outcome?: GameOutcome;
  squares: SquareDto[];
}

export interface GameOverEvent {
  room: string;
  outcome: GameOutcome;
  /** Cor vencedora no xeque-mate; null no afogamento. */
  winner: Color | null;
  snapshot: BoardSnapshot;
}

export interface CreateRoomResponse {
  room: string;
  alreadyExisted: boolean;
}

export interface JoinRoomResponse {
  connectionId: string | null;
  player: string | null;
  room: string | null;
  /** Cor efetivamente atribuida pelo servidor. */
  color: Color | null;
  /** Igual a `color`; nome que deixa explícito que a decisão é do servidor. */
  assignedColor?: Color | null;
  /** Falso quando a cor pedida estava tomada e o servidor atribuiu a outra. */
  preferenceHonoured?: boolean;
}

export interface StartGameResponse {
  success: boolean;
  message?: string;
  snapshot?: BoardSnapshot;
}

export interface PossibleMovesResponse {
  success: boolean;
  message?: string;
  from?: string;
  moves: SquareDto[];
}

export interface MakeMoveResponse {
  success: boolean;
  message?: string;
  from?: string;
  to?: string;
  nextTurn?: Color;
  outcome?: GameOutcome;
  /** Cor vencedora quando `outcome` é 'Checkmate'. */
  winner?: Color | null;
  snapshot?: BoardSnapshot;
}

export interface PlayerInRoom {
  name: string;
  color: Color;
}

export interface PlayerJoinedEvent {
  room: string;
  player: string;
  color: Color;
  players: PlayerInRoom[];
}

export interface PlayerLeftEvent {
  room: string;
  connectionId: string;
  player?: string;
  players: PlayerInRoom[];
}

export interface BoardChangedEvent {
  from: string;
  to: string;
  byColor: Color;
  nextTurn: Color;
  outcome?: GameOutcome;
  winner?: Color | null;
  snapshot: BoardSnapshot;
}

// ------------------------------------------------------------------------------------------------
// Coordenadas
//
// A convenção do backend tem os nomes trocados em relação ao que se esperaria, e é a armadilha
// número um deste repositório:
//
//   row    (0..7)  é o ARQUIVO   — a coluna vertical, `a`..`h`.  row = 0  ->  arquivo `a`
//   column (0..7)  é a FILEIRA   — a linha horizontal, e numerada AO CONTRÁRIO:
//                                  column = 0  ->  fileira 8   (peças pretas)
//                                  column = 7  ->  fileira 1   (peças brancas)
//
// `row`/`column` existem apenas para posicionar no grid. **Tudo que atravessa o fio é algébrico**
// (`"e2"`): toda chamada ao hub, todo log, todo `data-testid`. Converta com os helpers abaixo e nunca
// com aritmética escrita na hora — é assim que se inverte um tabuleiro sem perceber.
// ------------------------------------------------------------------------------------------------

/**
 * Letra do arquivo a partir do índice de linha. `0` → `'a'`, `7` → `'h'`.
 *
 * Sem validação de faixa: valor fora de 0..7 devolve um caractere qualquer em vez de erro. Os
 * chamadores iteram sempre sobre 0..7, então não há entrada externa aqui.
 */
export function fileFromRow(row: number): string {
  return String.fromCharCode('a'.charCodeAt(0) + row);
}

/**
 * Número da fileira a partir do índice de coluna. `0` → `8`, `7` → `1`.
 *
 * A subtração é o ponto todo: a numeração é invertida, então **não** é `column + 1`. Trocar por
 * `column + 1` desenha o tabuleiro de cabeça para baixo e faz `toAlgebraic` devolver a casa errada —
 * o que significa mandar o lance errado ao servidor.
 */
export function rankFromColumn(column: number): number {
  return 8 - column;
}

/**
 * Índices do grid para notação algébrica: `toAlgebraic(4, 6)` → `'e2'`.
 *
 * É a única forma de produzir a notação que vai ao hub. Se você se pegar escrevendo
 * `` `${letra}${numero}` `` em qualquer outro lugar, use isto.
 */
export function toAlgebraic(row: number, column: number): string {
  return `${fileFromRow(row)}${rankFromColumn(column)}`;
}
