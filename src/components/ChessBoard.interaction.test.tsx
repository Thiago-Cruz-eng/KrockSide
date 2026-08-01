import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HubConnectionState } from '@microsoft/signalr';
import ChessBoard from './ChessBoard';
import { createFakeHub, FakeHub, HubTestProvider } from '../test-utils/hub';
import { setAssignedColor } from '../service/gameSession';
import {
  BoardSnapshot,
  Color,
  GameOutcome,
  PieceDto,
  SquareDto,
  toAlgebraic,
} from '../types/chess';

/**
 * Regressões de interação do tabuleiro encontradas na Fase 2 do refactor.
 *
 * O tabuleiro estava injogável: a cor do jogador vinha do claim `role` do JWT, que
 * guarda o papel de autorização e não uma cor de peça, então nenhuma casa aceitava
 * clique. E o arrastar-e-soltar não consultava posse nem legalidade, deixando a UI
 * tentar jogadas que só o servidor recusava.
 */

function squaresWith(pieces: Record<string, PieceDto>): SquareDto[] {
  const out: SquareDto[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const algebraic = toAlgebraic(row, col);
      out.push({
        algebraic,
        file: algebraic[0],
        rank: 8 - col,
        row,
        column: col,
        squareColor: (row + col) % 2 === 0 ? 'White' : 'Black',
        piece: pieces[algebraic] ?? null,
      });
    }
  }
  return out;
}

const whitePawn: PieceDto = { type: 'Pawn', color: 'White', isInCheckState: false };
const blackPawn: PieceDto = { type: 'Pawn', color: 'Black', isInCheckState: false };

function snapshotOf(currentTurn: Color, outcome: GameOutcome = 'InProgress'): BoardSnapshot {
  return {
    room: 'r1',
    currentTurn,
    started: true,
    finished: outcome !== 'InProgress',
    outcome,
    squares: squaresWith({ e2: whitePawn, e7: blackPawn }),
  };
}

interface Harness {
  hub: FakeHub;
  calls: Array<{ method: string; args: unknown[] }>;
}

function renderBoard(currentTurn: Color = 'White', outcome: GameOutcome = 'InProgress'): Harness {
  const hub = createFakeHub(HubConnectionState.Connected);
  const calls: Array<{ method: string; args: unknown[] }> = [];

  hub.setInvoke(async (method, ...args) => {
    calls.push({ method, args });
    if (method === 'JoinRoom') {
      return { room: 'r1', player: 'p', color: 'White', connectionId: 'c1' };
    }
    if (method === 'StartGame') {
      return { success: true, snapshot: snapshotOf(currentTurn, outcome) };
    }
    if (method === 'GetPossibleMoves') {
      return { success: true, from: args[1], moves: [squaresWith({})[0]] };
    }
    return { success: true, snapshot: snapshotOf(currentTurn, outcome) };
  });

  render(
    <HubTestProvider hub={hub}>
      <MemoryRouter initialEntries={['/chess-board/r1/u1']}>
        <Routes>
          <Route path="/chess-board/:roomName/:id" element={<ChessBoard />} />
        </Routes>
      </MemoryRouter>
    </HubTestProvider>,
  );

  return { hub, calls };
}

function dropOn(square: HTMLElement, from: string): void {
  const dataTransfer = {
    getData: (key: string) => (key === 'from' ? from : ''),
    setData: () => undefined,
  } as unknown as DataTransfer;
  fireEvent.drop(square, { dataTransfer });
}

describe('ChessBoard — cor do jogador', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('usa a cor atribuída pelo servidor, e não o papel do JWT', async () => {
    setAssignedColor('r1', 'White');
    renderBoard('White');

    await waitFor(() =>
      expect(screen.getByTestId('player-color')).toHaveTextContent('White'),
    );
  });

  it('deixa o jogador selecionar a própria peça quando é a vez dele', async () => {
    setAssignedColor('r1', 'White');
    const { calls } = renderBoard('White');

    await waitFor(() => expect(screen.getByTestId('square-e2')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('square-e2'));

    await waitFor(() =>
      expect(calls.filter((c) => c.method === 'GetPossibleMoves')).toHaveLength(1),
    );
  });

  it('não pede lances quando é a vez do adversário', async () => {
    setAssignedColor('r1', 'White');
    const { calls } = renderBoard('Black');

    await waitFor(() => expect(screen.getByTestId('square-e2')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('square-e2'));

    expect(calls.filter((c) => c.method === 'GetPossibleMoves')).toHaveLength(0);
  });

  it('não pede lances para peça do adversário', async () => {
    setAssignedColor('r1', 'White');
    const { calls } = renderBoard('White');

    await waitFor(() => expect(screen.getByTestId('square-e7')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('square-e7'));

    expect(calls.filter((c) => c.method === 'GetPossibleMoves')).toHaveLength(0);
  });
});

describe('ChessBoard — fim de partida', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('anuncia o xeque-mate e diz quem ganhou', async () => {
    setAssignedColor('r1', 'White');
    const { hub } = renderBoard('Black', 'Checkmate');

    await waitFor(() => expect(screen.getByTestId('square-e2')).toBeInTheDocument());

    hub.emit('GameOver', {
      room: 'r1',
      outcome: 'Checkmate',
      winner: 'White',
      snapshot: snapshotOf('Black', 'Checkmate'),
    });

    await waitFor(() =>
      expect(screen.getByTestId('game-result')).toHaveTextContent(/você ganhou/i),
    );
  });

  it('anuncia o afogamento como empate', async () => {
    setAssignedColor('r1', 'White');
    renderBoard('White', 'Stalemate');

    await waitFor(() =>
      expect(screen.getByTestId('game-result')).toHaveTextContent(/afogamento/i),
    );
  });

  it('não aceita mais jogada depois do fim, mesmo sendo a sua vez', async () => {
    setAssignedColor('r1', 'White');
    const { calls } = renderBoard('White', 'Checkmate');

    await waitFor(() => expect(screen.getByTestId('game-result')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('square-e2'));

    expect(calls.filter((c) => c.method === 'GetPossibleMoves')).toHaveLength(0);
  });
});

describe('ChessBoard — arrastar e soltar', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('marca a própria peça como arrastável e a do adversário como não arrastável', async () => {
    setAssignedColor('r1', 'White');
    renderBoard('White');

    await waitFor(() => expect(screen.getByAltText('White Pawn')).toBeInTheDocument());
    expect(screen.getByAltText('White Pawn')).toHaveAttribute('draggable', 'true');
    expect(screen.getByAltText('Black Pawn')).toHaveAttribute('draggable', 'false');
  });

  /** Seleciona e2 e espera o destaque de a8 — o único destino que o stub devolve. */
  async function selectE2AndAwaitHighlight(): Promise<void> {
    await waitFor(() => expect(screen.getByTestId('square-e2')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('square-e2'));
    await waitFor(() =>
      expect(screen.getByTestId('square-a8').className).toContain('highlighted'),
    );
  }

  it('recusa soltar numa casa que o servidor não devolveu como destino legal', async () => {
    setAssignedColor('r1', 'White');
    const { calls } = renderBoard('White');

    await selectE2AndAwaitHighlight();

    // h5 não está entre os destinos: a UI não deve nem tentar.
    dropOn(screen.getByTestId('square-h5'), 'e2');

    expect(calls.filter((c) => c.method === 'MakeMove')).toHaveLength(0);
  });

  it('aceita soltar numa casa que o servidor devolveu como destino legal', async () => {
    setAssignedColor('r1', 'White');
    const { calls } = renderBoard('White');

    await selectE2AndAwaitHighlight();

    dropOn(screen.getByTestId('square-a8'), 'e2');

    await waitFor(() =>
      expect(calls.filter((c) => c.method === 'MakeMove')).toHaveLength(1),
    );
  });
});
