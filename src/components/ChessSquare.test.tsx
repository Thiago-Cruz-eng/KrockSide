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
    disabled: false,
    canDrag: false,
    onSelect: jest.fn(),
    onDropPiece: jest.fn(),
    onDragStartPiece: jest.fn(),
    ...props,
  };
  return { utils: render(<ChessSquare {...merged} />), props: merged };
}

describe('ChessSquare', () => {
  it('renders square with light/dark class from squareColor', () => {
    renderSquare({ square: makeSquare({ squareColor: 'Black' }) });
    expect(screen.getByTestId('square-e2').className).toContain('dark');
  });

  it('applies highlighted class only when highlighted=true', () => {
    const { utils } = renderSquare({ highlighted: true });
    expect(screen.getByTestId('square-e2').className).toContain('highlighted');
    utils.rerender(
      <ChessSquare
        square={makeSquare()}
        highlighted={false}
        disabled={false}
        canDrag={false}
        onSelect={jest.fn()}
        onDropPiece={jest.fn()}
        onDragStartPiece={jest.fn()}
      />,
    );
    expect(screen.getByTestId('square-e2').className).not.toContain('highlighted');
  });

  it('renders piece image when piece present and not None', () => {
    const piece: PieceDto = { type: 'Pawn', color: 'White', isInCheckState: false };
    renderSquare({ square: makeSquare({ piece }) });
    const img = screen.getByAltText('White Pawn');
    expect(img.getAttribute('src')).toMatch(/white-pawn\.png$/);
  });

  it('does not render image when piece type is None', () => {
    const piece: PieceDto = { type: 'None', color: 'None', isInCheckState: false };
    renderSquare({ square: makeSquare({ piece }) });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('calls onSelect with algebraic + piece on click', () => {
    const onSelect = jest.fn();
    const piece: PieceDto = { type: 'Knight', color: 'White', isInCheckState: false };
    renderSquare({ square: makeSquare({ piece }), onSelect });
    fireEvent.click(screen.getByTestId('square-e2'));
    expect(onSelect).toHaveBeenCalledWith('e2', piece);
  });

  it('does not call onSelect when disabled', () => {
    const onSelect = jest.fn();
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
    expect(screen.getByAltText('White Pawn')).toHaveAttribute('draggable', 'true');

    utils.rerender(
      <ChessSquare
        square={makeSquare({ piece })}
        highlighted={false}
        disabled={false}
        canDrag={false}
        onSelect={jest.fn()}
        onDropPiece={jest.fn()}
        onDragStartPiece={jest.fn()}
      />,
    );
    expect(screen.getByAltText('White Pawn')).toHaveAttribute('draggable', 'false');
  });

  it('does not publish a drag source when canDrag is false', () => {
    const onDragStartPiece = jest.fn();
    const setData = jest.fn();
    const piece: PieceDto = { type: 'Pawn', color: 'Black', isInCheckState: false };
    renderSquare({ square: makeSquare({ piece }), canDrag: false, onDragStartPiece });

    fireEvent.dragStart(screen.getByAltText('Black Pawn'), {
      dataTransfer: { setData } as unknown as DataTransfer,
    });

    expect(setData).not.toHaveBeenCalled();
    expect(onDragStartPiece).not.toHaveBeenCalled();
  });

  it('publishes the drag source and notifies the board when canDrag is true', () => {
    const onDragStartPiece = jest.fn();
    const setData = jest.fn();
    const piece: PieceDto = { type: 'Pawn', color: 'White', isInCheckState: false };
    renderSquare({ square: makeSquare({ piece }), canDrag: true, onDragStartPiece });

    fireEvent.dragStart(screen.getByAltText('White Pawn'), {
      dataTransfer: { setData } as unknown as DataTransfer,
    });

    expect(setData).toHaveBeenCalledWith('from', 'e2');
    expect(onDragStartPiece).toHaveBeenCalledWith('e2');
  });

  it('calls onDropPiece with from/to on drop', () => {
    const onDropPiece = jest.fn();
    renderSquare({ onDropPiece });
    const target = screen.getByTestId('square-e2');
    const dataTransfer = {
      getData: (key: string) => (key === 'from' ? 'e4' : ''),
    } as unknown as DataTransfer;
    fireEvent.drop(target, { dataTransfer });
    expect(onDropPiece).toHaveBeenCalledWith('e4', 'e2');
  });
});
