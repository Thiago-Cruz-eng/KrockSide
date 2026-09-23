import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HubConnectionState } from '@microsoft/signalr';
import ChessBoard from './ChessBoard';
import { createFakeHub, HubTestProvider } from '../test-utils/hub';
import { getAssignedColor, setAssignedColor, setPlayerName } from '../service/gameSession';
import { BoardSnapshot, SquareDto, toAlgebraic } from '../types/chess';

function emptySquares(): SquareDto[] {
  const out: SquareDto[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      out.push({
        algebraic: toAlgebraic(row, col),
        file: toAlgebraic(row, col)[0],
        rank: 8 - col,
        row,
        column: col,
        squareColor: (row + col) % 2 === 0 ? 'White' : 'Black',
        piece: null,
      });
    }
  }
  return out;
}

const snapshot: BoardSnapshot = {
  room: 'r1',
  currentTurn: 'White',
  started: true,
  finished: false,
  squares: emptySquares(),
};

describe('ChessBoard', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders 64 squares with algebraic test ids', async () => {
    const hub = createFakeHub(HubConnectionState.Connected);
    hub.setInvoke(async () => ({ success: true, snapshot }));

    render(
      <HubTestProvider hub={hub}>
        <MemoryRouter initialEntries={['/chess-board/r1/u1']}>
          <Routes>
            <Route path="/chess-board/:roomName/:id" element={<ChessBoard />} />
          </Routes>
        </MemoryRouter>
      </HubTestProvider>,
    );

    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByTestId(/^square-/)).toHaveLength(64);
    });
    expect(screen.getByTestId('square-a8')).toBeInTheDocument();
    expect(screen.getByTestId('square-h1')).toBeInTheDocument();
  });

  it('shows currentTurn from snapshot', async () => {
    const hub = createFakeHub(HubConnectionState.Connected);
    hub.setInvoke(async () => ({ success: true, snapshot }));

    render(
      <HubTestProvider hub={hub}>
        <MemoryRouter initialEntries={['/chess-board/r1/u1']}>
          <Routes>
            <Route path="/chess-board/:roomName/:id" element={<ChessBoard />} />
          </Routes>
        </MemoryRouter>
      </HubTestProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('current-turn')).toHaveTextContent('White'),
    );
  });

  /** Tabuleiro numa sala com nome codificado na URL, com o lobby como rota de destino. */
  function renderWithLobbyRoute(hub: ReturnType<typeof createFakeHub>, path: string) {
    return render(
      <HubTestProvider hub={hub}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/chess-board/:roomName/:id" element={<ChessBoard />} />
            <Route path="/chess-lobby/:id" element={<div data-testid="lobby-screen" />} />
          </Routes>
        </MemoryRouter>
      </HubTestProvider>,
    );
  }

  it('reads the room name already decoded from the route (no double decoding)', async () => {
    const hub = createFakeHub(HubConnectionState.Connected);
    const calls: string[] = [];
    hub.setInvoke(async (method, ...args) => {
      if (method === 'StartGame') calls.push(String(args[0]));
      return { success: true, snapshot: { ...snapshot, room: 'sala 100%' } };
    });

    renderWithLobbyRoute(hub, '/chess-board/sala%20100%25/u1');

    await waitFor(() => expect(screen.getAllByTestId(/^square-/)).toHaveLength(64));
    expect(screen.getByText('sala 100%')).toBeInTheDocument();
    // O hub recebe o nome real da sala, uma vez decodificado — `%25` virou `%`, e só.
    expect(calls).toContain('sala 100%');
  });

  it('"Sair da partida" leaves the room on the hub, forgets the seat and goes to the lobby', async () => {
    const hub = createFakeHub(HubConnectionState.Connected);
    const calls: Array<{ method: string; args: unknown[] }> = [];
    hub.setInvoke(async (method, ...args) => {
      calls.push({ method, args });
      if (method === 'LeaveRoom') return undefined;
      return { success: true, snapshot };
    });
    setAssignedColor('r1', 'White');
    setPlayerName('r1', 'Ana');

    renderWithLobbyRoute(hub, '/chess-board/r1/u1');
    await waitFor(() => expect(screen.getAllByTestId(/^square-/)).toHaveLength(64));

    fireEvent.click(screen.getByRole('button', { name: /Sair da partida/i }));

    await waitFor(() => expect(screen.getByTestId('lobby-screen')).toBeInTheDocument());
    expect(calls.find((c) => c.method === 'LeaveRoom')?.args).toEqual(['r1']);
    expect(getAssignedColor('r1')).toBe('None');
    expect(sessionStorage.getItem('playerName:r1')).toBeNull();
  });

  it('"Voltar ao lobby" on the error screen also leaves the room', async () => {
    const hub = createFakeHub(HubConnectionState.Connected);
    const calls: string[] = [];
    hub.setInvoke(async (method) => {
      calls.push(method);
      if (method === 'LeaveRoom') return undefined;
      if (method === 'StartGame') return { success: false, message: 'Room not found' };
      if (method === 'GetBoardSnapshot') return null;
      throw new Error(`unexpected ${method}`);
    });

    renderWithLobbyRoute(hub, '/chess-board/r1/u1');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Room not found'));

    fireEvent.click(screen.getByRole('button', { name: /Voltar ao lobby/i }));

    await waitFor(() => expect(screen.getByTestId('lobby-screen')).toBeInTheDocument());
    expect(calls).toContain('LeaveRoom');
  });
});
