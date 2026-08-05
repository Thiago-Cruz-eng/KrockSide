import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { HubConnectionState } from '@microsoft/signalr';
import { useChessGame } from './useChessGame';
import { createFakeHub, HubTestProvider } from '../test-utils/hub';
import {
  BoardSnapshot,
  MakeMoveResponse,
  PossibleMovesResponse,
  SquareDto,
  StartGameResponse,
  toAlgebraic,
} from '../types/chess';

function makeSquare(row: number, column: number): SquareDto {
  return {
    algebraic: toAlgebraic(row, column),
    file: toAlgebraic(row, column)[0],
    rank: 8 - column,
    row,
    column,
    squareColor: (row + column) % 2 === 0 ? 'White' : 'Black',
    piece: null,
  };
}

const sampleSnapshot: BoardSnapshot = {
  room: 'room-1',
  currentTurn: 'White',
  started: true,
  finished: false,
  squares: [makeSquare(0, 0), makeSquare(0, 1), makeSquare(4, 6)],
};

function wrapWith(hub: ReturnType<typeof createFakeHub>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <HubTestProvider hub={hub}>{children}</HubTestProvider>;
  };
}

describe('useChessGame', () => {
  it('loads snapshot via StartGame on mount', async () => {
    const hub = createFakeHub(HubConnectionState.Connected);
    const start: StartGameResponse = { success: true, snapshot: sampleSnapshot };
    hub.setInvoke(async (method) => {
      if (method === 'StartGame') return start;
      throw new Error(`unexpected ${method}`);
    });

    const { result } = renderHook(() => useChessGame('room-1'), {
      wrapper: wrapWith(hub),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.squares).toHaveLength(3);
    expect(result.current.currentTurn).toBe('White');
  });

  it('updates snapshot on BoardChanged event', async () => {
    const hub = createFakeHub(HubConnectionState.Connected);
    hub.setInvoke(async () => ({ success: true, snapshot: sampleSnapshot }));
    const { result } = renderHook(() => useChessGame('room-1'), {
      wrapper: wrapWith(hub),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const newSnapshot: BoardSnapshot = {
      ...sampleSnapshot,
      currentTurn: 'Black',
    };
    act(() =>
      hub.emit('BoardChanged', {
        from: 'e2',
        to: 'e4',
        byColor: 'White',
        nextTurn: 'Black',
        snapshot: newSnapshot,
      }),
    );
    await waitFor(() => expect(result.current.currentTurn).toBe('Black'));
  });

  it('highlights moves returned by GetPossibleMoves', async () => {
    const hub = createFakeHub(HubConnectionState.Connected);
    const moves: PossibleMovesResponse = {
      success: true,
      from: 'e2',
      moves: [makeSquare(4, 4), makeSquare(4, 5)],
    };
    hub.setInvoke(async (method) => {
      if (method === 'StartGame') return { success: true, snapshot: sampleSnapshot };
      if (method === 'GetPossibleMoves') return moves;
      throw new Error(`unexpected ${method}`);
    });

    const { result } = renderHook(() => useChessGame('room-1'), {
      wrapper: wrapWith(hub),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.requestPossibleMoves('e2');
    });
    expect(result.current.highlighted.size).toBe(2);
  });

  it('records lastMoveError when MakeMove fails', async () => {
    const hub = createFakeHub(HubConnectionState.Connected);
    const failed: MakeMoveResponse = { success: false, message: 'Not your turn.' };
    hub.setInvoke(async (method) => {
      if (method === 'StartGame') return { success: true, snapshot: sampleSnapshot };
      if (method === 'MakeMove') return failed;
      throw new Error(`unexpected ${method}`);
    });

    const { result } = renderHook(() => useChessGame('room-1'), {
      wrapper: wrapWith(hub),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.makeMove('e2', 'e4');
    });
    expect(result.current.lastMoveError).toBe('Not your turn.');
  });

  it('applies snapshot from successful MakeMove', async () => {
    const hub = createFakeHub(HubConnectionState.Connected);
    const newSnapshot: BoardSnapshot = { ...sampleSnapshot, currentTurn: 'Black' };
    hub.setInvoke(async (method) => {
      if (method === 'StartGame') return { success: true, snapshot: sampleSnapshot };
      if (method === 'MakeMove')
        return {
          success: true,
          from: 'e2',
          to: 'e4',
          nextTurn: 'Black',
          snapshot: newSnapshot,
        } as MakeMoveResponse;
      throw new Error(`unexpected ${method}`);
    });

    const { result } = renderHook(() => useChessGame('room-1'), {
      wrapper: wrapWith(hub),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.makeMove('e2', 'e4');
    });
    expect(result.current.currentTurn).toBe('Black');
  });
});
