import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { HubConnectionState } from '@microsoft/signalr';
import ChessBoard from './ChessBoard';
import { createFakeHub, HubTestProvider } from '../test-utils/hub';
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

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
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
});
