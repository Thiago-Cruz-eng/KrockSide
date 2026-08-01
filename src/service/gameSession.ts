import { Color } from '../types/chess';

/**
 * Estado de sessão de uma partida que o cliente precisa lembrar entre telas.
 *
 * Existe por causa de um bug real: o ChessBoard derivava a cor do jogador do claim
 * `role` do JWT, que carrega o papel de autorização ("jogador", "adm"), nunca uma cor
 * de peça. O resultado era `playerColor === 'None'` sempre, `isMyTurn` sempre falso e
 * todas as casas desabilitadas — o tabuleiro não aceitava um único clique.
 *
 * A cor é atribuída pelo servidor em JoinRoom, que é a única autoridade sobre ela. O
 * lobby guarda aqui a resposta do servidor e o tabuleiro lê. Escopo de sessão: a
 * atribuição está amarrada ao ConnectionId do SignalR, que morre junto com a aba.
 */
const COLOR_KEY = (room: string) => `assignedColor:${room}`;

export function setAssignedColor(room: string, color: Color | null | undefined): void {
  if (!room || !color || color === 'None') return;
  sessionStorage.setItem(COLOR_KEY(room), color);
}

export function getAssignedColor(room: string | undefined): Color {
  if (!room) return 'None';
  const stored = sessionStorage.getItem(COLOR_KEY(room));
  return stored === 'White' || stored === 'Black' ? stored : 'None';
}

export function clearAssignedColor(room: string | undefined): void {
  if (!room) return;
  sessionStorage.removeItem(COLOR_KEY(room));
}
