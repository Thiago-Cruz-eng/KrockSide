import React from 'react';
import '../styles/ChessSquare.css';
import '../styles/ChessPiece.css';
import { PieceDto, SquareDto } from '../types/chess';

export interface ChessSquareProps {
  square: SquareDto;
  highlighted: boolean;
  /** Bloqueia clique e soltura — usado quando não é a vez do jogador. */
  disabled: boolean;
  /**
   * A peça desta casa pode ser arrastada: falso para casa vazia, para peça do
   * adversário e fora da vez. O atributo `draggable` seguia apenas `disabled`, então
   * na sua vez as peças do adversário também eram arrastáveis na tela.
   */
  canDrag: boolean;
  onSelect: (algebraic: string, piece: PieceDto | null) => void;
  onDropPiece: (from: string, to: string) => void;
  /** Avisa o tabuleiro para já buscar os destinos legais no início do arrasto. */
  onDragStartPiece: (algebraic: string) => void;
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
  canDrag,
  onSelect,
  onDropPiece,
  onDragStartPiece,
}) => {
  const { algebraic, squareColor, piece } = square;

  const handleDragStart = (e: React.DragEvent) => {
    if (!piece || !canDrag) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('from', algebraic);
    onDragStartPiece(algebraic);
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
          // BASE_URL do Vite substitui PUBLIC_URL do CRA e ja termina com '/'.
          src={`${import.meta.env.BASE_URL}${piece.color.toLowerCase()}-${piece.type.toLowerCase()}.png`}
          alt={`${piece.color} ${piece.type}`}
          draggable={canDrag}
          onDragStart={handleDragStart}
          className={`chess-piece ${sizeClass}`}
        />
      )}
    </div>
  );
};

export default ChessSquare;
