import React from 'react';
import ChessPiece from './ChessPiece';
import { PieceDto, SquareDto } from '../types/chess';

export interface ChessSquareProps {
  square: SquareDto;
  /** Destino legal para a peça selecionada — desenha o ponto de lance. */
  highlighted: boolean;
  /** Casa de origem da seleção atual. */
  selected: boolean;
  /** Faz parte do último lance aplicado. */
  lastMove: boolean;
  /** O rei desta casa está em xeque. */
  inCheck: boolean;
  /** Bloqueia clique e soltura — usado quando não é a vez do jogador. */
  disabled: boolean;
  /** A peça desta casa pode ser arrastada: é sua, é sua vez, e a partida não acabou. */
  canDrag: boolean;
  /** Letra do arquivo a desenhar nesta casa (só na fileira de baixo), ou null. */
  fileLabel: string | null;
  /** Número da fileira a desenhar nesta casa (só na coluna da esquerda), ou null. */
  rankLabel: number | null;
  onSelect: (algebraic: string, piece: PieceDto | null) => void;
  onDropPiece: (from: string, to: string) => void;
  onDragStartPiece: (algebraic: string) => void;
}

const ChessSquare: React.FC<ChessSquareProps> = ({
  square,
  highlighted,
  selected,
  lastMove,
  inCheck,
  disabled,
  canDrag,
  fileLabel,
  rankLabel,
  onSelect,
  onDropPiece,
  onDragStartPiece,
}) => {
  const { algebraic, squareColor, piece } = square;
  const hasPiece = piece !== null && piece.type !== 'None';

  const handleDragStart = (e: React.DragEvent) => {
    if (!hasPiece || !canDrag) {
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

  // `light`/`dark` são mantidos porque a suíte verifica a cor da casa por eles.
  const classes = [
    'square',
    squareColor === 'White' ? 'light' : 'dark',
    highlighted && 'highlighted',
    selected && 'square--selected',
    lastMove && 'square--lastmove',
    inCheck && 'square--check',
    canDrag && 'square--can-drag',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      data-testid={`square-${algebraic}`}
      data-algebraic={algebraic}
      className={classes}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      {rankLabel !== null && <span className="square__rank">{rankLabel}</span>}
      {fileLabel !== null && <span className="square__file">{fileLabel}</span>}

      {hasPiece && (
        <ChessPiece
          type={piece!.type}
          color={piece!.color}
          draggable={canDrag}
          onDragStart={handleDragStart}
        />
      )}

      {/* Ponto de destino legal. Anel quando há peça a capturar, disco quando vazio. */}
      {highlighted && (
        <span className={hasPiece ? 'square__hint square__hint--capture' : 'square__hint'} />
      )}
    </div>
  );
};

export default ChessSquare;
