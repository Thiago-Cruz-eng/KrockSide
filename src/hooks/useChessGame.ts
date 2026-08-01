import { useCallback, useEffect, useState } from 'react';
import { HubConnectionState } from '@microsoft/signalr';
import { useHubConnection } from './useHubConnection';
import {
  BoardChangedEvent,
  BoardSnapshot,
  Color,
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
    void start();

    const offBoardChanged = on('BoardChanged', (...args) => {
      const payload = args[0] as BoardChangedEvent;
      setSnapshot(applySnapshot(payload.snapshot));
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
      offPlayerJoined();
    };
  }, [state, start, on]);

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
    error,
    lastMoveError,
    requestPossibleMoves,
    makeMove,
    clearHighlights,
    refresh,
  };
}
