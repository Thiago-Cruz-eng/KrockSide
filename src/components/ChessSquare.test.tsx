import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChessSquare from './ChessSquare';
import { PieceDto, SquareDto } from '../types/chess';

function makeSquare(overrides: Partial<SquareDto> = {}): SquareDto {
  return {
    algebraic: 'e2',
    file: 'e',
    rank: 2,
    row: 4,
    column: 6,
    squareColor: 'White',
    piece: null,
    ...overrides,
  };
}

function renderSquare(
  props: Partial<React.ComponentProps<typeof ChessSquare>> = {},
) {
  const merged: React.ComponentProps<typeof ChessSquare> = {
    square: makeSquare(),
    highlighted: false,
    selected: false,
    lastMove: false,
    inCheck: false,
    disabled: false,
    canDrag: false,
    fileLabel: null,
    rankLabel: null,
    onSelect: vi.fn(),
    onDropPiece: vi.fn(),
    onDragStartPiece: vi.fn(),
    ...props,
  };
  return { utils: render(<ChessSquare {...merged} />), props: merged };
}

/** Rerender com o mesmo default do renderSquare, sobrescrevendo só o que interessa. */
function rerenderSquare(
  utils: ReturnType<typeof render>,
  props: Partial<React.ComponentProps<typeof ChessSquare>> = {},
) {
  utils.rerender(
    <ChessSquare
      square={makeSquare()}
      highlighted={false}
      selected={false}
      lastMove={false}
      inCheck={false}
      disabled={false}
      canDrag={false}
      fileLabel={null}
      rankLabel={null}
      onSelect={vi.fn()}
      onDropPiece={vi.fn()}
      onDragStartPiece={vi.fn()}
      {...props}
    />,
  );
}

describe('ChessSquare', () => {
  it('renders square with light/dark class from squareColor', () => {
    renderSquare({ square: makeSquare({ squareColor: 'Black' }) });
    expect(screen.getByTestId('square-e2').className).toContain('dark');
  });

  it('applies highlighted class only when highlighted=true', () => {
    const { utils } = renderSquare({ highlighted: true });
    expect(screen.getByTestId('square-e2').className).toContain('highlighted');
    rerenderSquare(utils, { highlighted: false });
    expect(screen.getByTestId('square-e2').className).not.toContain('highlighted');
  });

  // A peça deixou de ser <img src="white-pawn.png"> e passou a ser o glifo Unicode
  // colorido por CSS, com role="img" e aria-label. Escala sem perder nitidez e dispensa
  // 1,8 MB de PNG.
  it('renders the piece glyph with an accessible name', () => {
    const piece: PieceDto = { type: 'Pawn', color: 'White', isInCheckState: false };
    renderSquare({ square: makeSquare({ piece }) });

    const rendered = screen.getByLabelText('Peão branco');
    expect(rendered).toHaveTextContent('♟');
    expect(rendered.className).toContain('piece--white');
  });

  it('distinguishes black pieces by class, not by a different glyph', () => {
    const piece: PieceDto = { type: 'Queen', color: 'Black', isInCheckState: false };
    renderSquare({ square: makeSquare({ piece }) });

    const rendered = screen.getByLabelText('Dama preta');
    expect(rendered).toHaveTextContent('♛');
    expect(rendered.className).toContain('piece--black');
  });

  it('does not render image when piece type is None', () => {
    const piece: PieceDto = { type: 'None', color: 'None', isInCheckState: false };
    renderSquare({ square: makeSquare({ piece }) });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('calls onSelect with algebraic + piece on click', () => {
    const onSelect = vi.fn();
    const piece: PieceDto = { type: 'Knight', color: 'White', isInCheckState: false };
    renderSquare({ square: makeSquare({ piece }), onSelect });
    fireEvent.click(screen.getByTestId('square-e2'));
    expect(onSelect).toHaveBeenCalledWith('e2', piece);
  });

  it('does not call onSelect when disabled', () => {
    const onSelect = vi.fn();
    renderSquare({ disabled: true, onSelect });
    fireEvent.click(screen.getByTestId('square-e2'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  // Regressão: `draggable` seguia apenas `disabled`, então na sua vez as peças do
  // adversário também eram arrastáveis, e o dragstart publicava a casa de origem de
  // qualquer peça — a UI propunha jogadas que só o servidor recusava.
  it('marks the piece as draggable only when canDrag is true', () => {
    const piece: PieceDto = { type: 'Pawn', color: 'White', isInCheckState: false };

    const { utils } = renderSquare({ square: makeSquare({ piece }), canDrag: true });
    expect(screen.getByLabelText('Peão branco')).toHaveAttribute('draggable', 'true');

    rerenderSquare(utils, { square: makeSquare({ piece }), canDrag: false });
    expect(screen.getByLabelText('Peão branco')).toHaveAttribute('draggable', 'false');
  });

  it('does not publish a drag source when canDrag is false', () => {
    const onDragStartPiece = vi.fn();
    const setData = vi.fn();
    const piece: PieceDto = { type: 'Pawn', color: 'Black', isInCheckState: false };
    renderSquare({ square: makeSquare({ piece }), canDrag: false, onDragStartPiece });

    fireEvent.dragStart(screen.getByLabelText('Peão preto'), {
      dataTransfer: { setData } as unknown as DataTransfer,
    });

    expect(setData).not.toHaveBeenCalled();
    expect(onDragStartPiece).not.toHaveBeenCalled();
  });

  it('publishes the drag source and notifies the board when canDrag is true', () => {
    const onDragStartPiece = vi.fn();
    const setData = vi.fn();
    const piece: PieceDto = { type: 'Pawn', color: 'White', isInCheckState: false };
    renderSquare({ square: makeSquare({ piece }), canDrag: true, onDragStartPiece });

    fireEvent.dragStart(screen.getByLabelText('Peão branco'), {
      dataTransfer: { setData } as unknown as DataTransfer,
    });

    expect(setData).toHaveBeenCalledWith('from', 'e2');
    expect(onDragStartPiece).toHaveBeenCalledWith('e2');
  });

  it('calls onDropPiece with from/to on drop', () => {
    const onDropPiece = vi.fn();
    renderSquare({ onDropPiece });
    const target = screen.getByTestId('square-e2');
    const dataTransfer = {
      getData: (key: string) => (key === 'from' ? 'e4' : ''),
    } as unknown as DataTransfer;
    fireEvent.drop(target, { dataTransfer });
    expect(onDropPiece).toHaveBeenCalledWith('e4', 'e2');
  });
});
