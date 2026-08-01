import React, { useCallback, useMemo, useState } from 'react';
import '../styles/ChessBoard.css';
import { useParams } from 'react-router-dom';
import ChessSquare from './ChessSquare';
import { useChessGame } from '../hooks/useChessGame';
import { useAuth } from '../hooks/useAuth';
import { Color, PieceDto, SquareDto, toAlgebraic } from '../types/chess';

const BOARD_SIZE = 8;

function selfColor(decodedRole?: string): Color {
  if (decodedRole === 'white') return 'White';
  if (decodedRole === 'black') return 'Black';
  return 'None';
}

const ChessBoard: React.FC = () => {
  const { roomName, id } = useParams<{ roomName: string; id: string }>();
  const { decoded } = useAuth(id);
  const {
    squares,
    currentTurn,
    highlighted,
    loading,
    error,
    lastMoveError,
    requestPossibleMoves,
    makeMove,
    clearHighlights,
  } = useChessGame(roomName);

  const [selected, setSelected] = useState<string | null>(null);

  const playerColor: Color = useMemo(
    () => selfColor(decoded?.role),
    [decoded],
  );

  const isMyTurn = playerColor !== 'None' && playerColor === currentTurn;

  const squareIndex = useMemo(() => {
    const map = new Map<string, SquareDto>();
    squares.forEach((sq) => map.set(sq.algebraic, sq));
    return map;
  }, [squares]);

  const handleSelect = useCallback(
    async (algebraic: string, piece: PieceDto | null) => {
      if (selected && selected !== algebraic) {
        const result = await makeMove(selected, algebraic);
        setSelected(null);
        if (!result.success) clearHighlights();
        return;
      }
      if (!piece || piece.color !== playerColor) {
        setSelected(null);
        clearHighlights();
        return;
      }
      setSelected(algebraic);
      await requestPossibleMoves(algebraic);
    },
    [selected, makeMove, playerColor, requestPossibleMoves, clearHighlights],
  );

  const handleDropPiece = useCallback(
    async (from: string, to: string) => {
      await makeMove(from, to);
      setSelected(null);
    },
    [makeMove],
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div role="alert">Erro: {error}</div>;

  return (
    <div>
      <div className="board-status">
        <span data-testid="current-turn">Turno: {currentTurn}</span>
        <span data-testid="player-color">Você: {playerColor}</span>
      </div>
      {lastMoveError && <div role="alert">{lastMoveError}</div>}
      <div className="chessboard">
        {Array.from({ length: BOARD_SIZE }).map((_, col) => (
          <div key={col} className="row">
            {Array.from({ length: BOARD_SIZE }).map((_, row) => {
              const algebraic = toAlgebraic(row, col);
              const square: SquareDto =
                squareIndex.get(algebraic) ?? {
                  algebraic,
                  file: algebraic[0],
                  rank: parseInt(algebraic.slice(1), 10),
                  row,
                  column: col,
                  squareColor: (row + col) % 2 === 0 ? 'White' : 'Black',
                  piece: null,
                };
              return (
                <ChessSquare
                  key={algebraic}
                  square={square}
                  highlighted={highlighted.has(algebraic)}
                  disabled={!isMyTurn}
                  onSelect={handleSelect}
                  onDropPiece={handleDropPiece}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChessBoard;
