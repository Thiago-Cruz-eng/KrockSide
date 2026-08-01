import React from 'react';
import '../styles/ChessSquare.css';
import '../styles/ChessPiece.css';
import { PieceDto, SquareDto } from '../types/chess';

export interface ChessSquareProps {
  square: SquareDto;
  highlighted: boolean;
  disabled: boolean;
  onSelect: (algebraic: string, piece: PieceDto | null) => void;
  onDropPiece: (from: string, to: string) => void;
}

function getSizeClass(type: string): string {
  const t = type.toLowerCase();
  if (t === 'pawn') return 'small';
  if (['rook', 'knight', 'bishop'].includes(t)) return 'medium';
  if (t === 'queen') return 'medium-plus';
  if (t === 'king') return 'large';
  return '';
}

const ChessSquare: React.FC<ChessSquareProps> = ({
  square,
  highlighted,
  disabled,
  onSelect,
  onDropPiece,
}) => {
  const { algebraic, squareColor, piece } = square;

  const handleDragStart = (e: React.DragEvent) => {
    if (!piece) return;
    e.dataTransfer.setData('from', algebraic);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    const from = e.dataTransfer.getData('from');
    if (!from || from === algebraic) return;
    onDropPiece(from, algebraic);
  };

  const handleClick = () => {
    if (disabled) return;
    onSelect(algebraic, piece);
  };

  const colorClass = squareColor === 'White' ? 'light' : 'dark';
  const sizeClass = piece ? getSizeClass(piece.type) : '';

  return (
    <div
      data-testid={`square-${algebraic}`}
      data-algebraic={algebraic}
      className={`chess-square ${colorClass} ${highlighted ? 'highlighted' : ''}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      {piece && piece.type !== 'None' && (
        <img
          src={`${process.env.PUBLIC_URL}/${piece.color.toLowerCase()}-${piece.type.toLowerCase()}.png`}
          alt={`${piece.color} ${piece.type}`}
          draggable={!disabled}
          onDragStart={handleDragStart}
          className={`chess-piece ${sizeClass}`}
        />
      )}
    </div>
  );
};

export default ChessSquare;
