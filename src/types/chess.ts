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

export interface BoardSnapshot {
  room: string;
  currentTurn: Color;
  started: boolean;
  finished: boolean;
  squares: SquareDto[];
}

export interface CreateRoomResponse {
  room: string;
  alreadyExisted: boolean;
}

export interface JoinRoomResponse {
  connectionId: string | null;
  player: string | null;
  room: string | null;
  color: Color | null;
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
  snapshot: BoardSnapshot;
}

export function fileFromRow(row: number): string {
  return String.fromCharCode('a'.charCodeAt(0) + row);
}

export function rankFromColumn(column: number): number {
  return 8 - column;
}

export function toAlgebraic(row: number, column: number): string {
  return `${fileFromRow(row)}${rankFromColumn(column)}`;
}
