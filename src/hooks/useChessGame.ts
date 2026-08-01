import { useCallback, useEffect, useState } from 'react';
import { HubConnectionState } from '@microsoft/signalr';
import { useHubConnection } from './useHubConnection';
import { getAssignedColor, getPlayerName, setAssignedColor } from '../service/gameSession';
import {
  BoardChangedEvent,
  BoardSnapshot,
  Color,
  GameOutcome,
  GameOverEvent,
  JoinRoomResponse,
  MakeMoveResponse,
  PossibleMovesResponse,
  SquareDto,
  StartGameResponse,
} from '../types/chess';

export interface ChessGameApi {
  snapshot: BoardSnapshot | null;
  squares: SquareDto[];
  currentTurn: Color;
  highlighted: Set<string>;
  loading: boolean;
  /** A sala existe mas ainda não tem dois jogadores. Não é erro. */
  waitingForOpponent: boolean;
  /** Situação da partida na vez de `currentTurn`. */
  outcome: GameOutcome;
  /** Cor vencedora no xeque-mate; null enquanto a partida corre e no afogamento. */
  winner: Color | null;
  error: string | null;
  lastMoveError: string | null;
  requestPossibleMoves: (from: string) => Promise<PossibleMovesResponse>;
  makeMove: (from: string, to: string) => Promise<MakeMoveResponse>;
  clearHighlights: () => void;
  refresh: () => Promise<void>;
}

function applySnapshot(snapshot: BoardSnapshot | null | undefined): BoardSnapshot | null {
  return snapshot ?? null;
}

export function useChessGame(roomName: string | undefined): ChessGameApi {
  const { state, invoke, on } = useHubConnection();
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [winner, setWinner] = useState<Color | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastMoveError, setLastMoveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!roomName) return;
    try {
      const result = await invoke<BoardSnapshot>('GetBoardSnapshot', roomName);
      setSnapshot(applySnapshot(result));
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch board');
      setLoading(false);
    }
  }, [invoke, roomName]);

  /**
   * Reentra na sala antes de qualquer outra coisa.
   *
   * O SignalR reconecta sozinho depois de uma queda, mas com um ConnectionId novo — e o
   * servidor já liberou o assento anterior. Sem reentrar, o tabuleiro continuava na tela
   * e toda jogada respondia "You are not in this room"; F5 tinha o mesmo efeito.
   *
   * É seguro chamar sempre: se a conexão já tem assento, o servidor devolve a mesma cor
   * sem alterar nada. A cor pedida é a que já foi atribuída, para recuperar o mesmo lado.
   */
  const rejoin = useCallback(async () => {
    if (!roomName) return;
    const playerName = getPlayerName(roomName);
    if (!playerName) return;

    try {
      const result = await invoke<JoinRoomResponse>(
        'JoinRoom',
        playerName,
        roomName,
        getAssignedColor(roomName),
      );
      if (result.color && result.color !== 'None') setAssignedColor(roomName, result.color);
    } catch (err) {
      console.error('Rejoin failed:', err);
    }
  }, [invoke, roomName]);

  const start = useCallback(async () => {
    if (!roomName) return;
    try {
      const result = await invoke<StartGameResponse>('StartGame', roomName);
      if (result.success && result.snapshot) {
        setSnapshot(result.snapshot);
        setWaitingForOpponent(false);
        setError(null);
        setLoading(false);
        return;
      }

      // StartGame recusa enquanto a sala não tem dois jogadores. Isso não é erro: é o
      // primeiro jogador esperando o adversário. Tratar como erro deixava esse jogador
      // olhando para uma tela de "Erro:" em vez do tabuleiro.
      const existing = await invoke<BoardSnapshot | null>('GetBoardSnapshot', roomName);
      if (existing) {
        setSnapshot(existing);
        setWaitingForOpponent(!existing.started);
        setError(null);
        setLoading(false);
        return;
      }

      setError(result.message ?? 'StartGame failed');
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game');
      setLoading(false);
    }
  }, [invoke, roomName]);

  useEffect(() => {
    if (state !== HubConnectionState.Connected) return;

    // Reentrar primeiro, iniciar depois: sem assento na sala, StartGame e MakeMove são
    // recusados. Roda também na primeira conexão, onde é inofensivo.
    void rejoin().then(start);

    const offBoardChanged = on('BoardChanged', (...args) => {
      const payload = args[0] as BoardChangedEvent;
      setSnapshot(applySnapshot(payload.snapshot));
      setHighlighted(new Set());
      if (payload.winner !== undefined) setWinner(payload.winner);
    });
    // Evento próprio de fim de partida: não é preciso inspecionar todo BoardChanged.
    const offGameOver = on('GameOver', (...args) => {
      const payload = args[0] as GameOverEvent;
      setSnapshot(applySnapshot(payload.snapshot));
      setWinner(payload.winner);
      setHighlighted(new Set());
    });
    const offGameStarted = on('GameStarted', (...args) => {
      setSnapshot(applySnapshot(args[0] as BoardSnapshot));
      setWaitingForOpponent(false);
      setLoading(false);
    });
    // Quem chegou primeiro tenta iniciar de novo quando o adversário entra.
    const offPlayerJoined = on('PlayerJoined', () => {
      void start();
    });

    return () => {
      offBoardChanged();
      offGameStarted();
      offGameOver();
      offPlayerJoined();
    };
  }, [state, rejoin, start, on]);

  const requestPossibleMoves = useCallback(
    async (from: string): Promise<PossibleMovesResponse> => {
      if (!roomName) {
        return { success: false, message: 'No room', moves: [] };
      }
      const result = await invoke<PossibleMovesResponse>(
        'GetPossibleMoves',
        roomName,
        from,
      );
      if (result.success) {
        setHighlighted(new Set(result.moves.map((m) => m.algebraic)));
      } else {
        setHighlighted(new Set());
        setLastMoveError(result.message ?? null);
      }
      return result;
    },
    [invoke, roomName],
  );

  const makeMove = useCallback(
    async (from: string, to: string): Promise<MakeMoveResponse> => {
      if (!roomName) {
        return { success: false, message: 'No room' };
      }
      const result = await invoke<MakeMoveResponse>(
        'MakeMove',
        roomName,
        from,
        to,
      );
      if (result.success && result.snapshot) {
        setSnapshot(result.snapshot);
        setHighlighted(new Set());
        setLastMoveError(null);
        if (result.winner !== undefined) setWinner(result.winner);
      } else if (!result.success) {
        setLastMoveError(result.message ?? 'Move rejected');
      }
      return result;
    },
    [invoke, roomName],
  );

  const clearHighlights = useCallback(() => setHighlighted(new Set()), []);

  return {
    snapshot,
    squares: snapshot?.squares ?? [],
    currentTurn: snapshot?.currentTurn ?? 'None',
    highlighted,
    loading,
    waitingForOpponent,
    outcome: snapshot?.outcome ?? 'InProgress',
    winner,
    error,
    lastMoveError,
    requestPossibleMoves,
    makeMove,
    clearHighlights,
    refresh,
  };
}
