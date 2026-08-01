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
    onSelect: jest.fn(),
    onDropPiece: jest.fn(),
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
        onSelect={jest.fn()}
        onDropPiece={jest.fn()}
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
