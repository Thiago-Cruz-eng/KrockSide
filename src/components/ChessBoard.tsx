import React, { useCallback, useMemo, useState } from 'react';
import '../styles/ChessBoard.css';
import { useParams } from 'react-router-dom';
import ChessSquare from './ChessSquare';
import { useChessGame } from '../hooks/useChessGame';
import { getAssignedColor } from '../service/gameSession';
import { Color, PieceDto, SquareDto, toAlgebraic } from '../types/chess';

const BOARD_SIZE = 8;

const ChessBoard: React.FC = () => {
  const { roomName } = useParams<{ roomName: string; id: string }>();
  const {
    squares,
    currentTurn,
    highlighted,
    loading,
    waitingForOpponent,
    error,
    lastMoveError,
    requestPossibleMoves,
    makeMove,
    clearHighlights,
  } = useChessGame(roomName);

  const [selected, setSelected] = useState<string | null>(null);

  // A cor vem do servidor, atribuída em JoinRoom e guardada pelo lobby. Antes era
  // derivada do claim `role` do JWT, que carrega o papel de autorização ("jogador"),
  // nunca uma cor de peça: playerColor era sempre 'None', isMyTurn sempre falso e o
  // tabuleiro inteiro ficava desabilitado — nenhum clique funcionava.
  const playerColor: Color = useMemo(() => getAssignedColor(roomName), [roomName]);

  const isMyTurn = playerColor !== 'None' && playerColor === currentTurn;

  const squareIndex = useMemo(() => {
    const map = new Map<string, SquareDto>();
    squares.forEach((sq) => map.set(sq.algebraic, sq));
    return map;
  }, [squares]);

  const isOwnPiece = useCallback(
    (piece: PieceDto | null) =>
      piece !== null && piece.type !== 'None' && piece.color === playerColor,
    [playerColor],
  );

  const handleSelect = useCallback(
    async (algebraic: string, piece: PieceDto | null) => {
      // Segundo clique: tenta o lance, desde que o destino esteja entre os que o
      // servidor devolveu como legais.
      if (selected && selected !== algebraic) {
        if (highlighted.size > 0 && !highlighted.has(algebraic)) {
          setSelected(null);
          clearHighlights();
          return;
        }
        const result = await makeMove(selected, algebraic);
        setSelected(null);
        if (!result.success) clearHighlights();
        return;
      }

      if (!isOwnPiece(piece)) {
        setSelected(null);
        clearHighlights();
        return;
      }

      setSelected(algebraic);
      await requestPossibleMoves(algebraic);
    },
    [selected, highlighted, makeMove, isOwnPiece, requestPossibleMoves, clearHighlights],
  );

  // Busca os destinos legais assim que o arrasto começa, para que a soltura já tenha
  // com o que se comparar.
  const handleDragStartPiece = useCallback(
    (algebraic: string) => {
      setSelected(algebraic);
      void requestPossibleMoves(algebraic);
    },
    [requestPossibleMoves],
  );

  const handleDropPiece = useCallback(
    async (from: string, to: string) => {
      // O servidor continua sendo a autoridade — isto só impede a UI de propor um
      // lance que ela já sabe ser ilegal. Se os destaques ainda não chegaram, deixa
      // passar e o servidor decide.
      if (highlighted.size > 0 && !highlighted.has(to)) {
        setSelected(null);
        clearHighlights();
        return;
      }
      await makeMove(from, to);
      setSelected(null);
    },
    [makeMove, highlighted, clearHighlights],
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div role="alert">Erro: {error}</div>;

  return (
    <div>
      <div className="board-status">
        <span data-testid="current-turn">Turno: {currentTurn}</span>
        <span data-testid="player-color">Você: {playerColor}</span>
      </div>
      {waitingForOpponent && (
        <div data-testid="waiting-opponent">Aguardando adversário…</div>
      )}
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
                  canDrag={isMyTurn && isOwnPiece(square.piece)}
                  onSelect={handleSelect}
                  onDropPiece={handleDropPiece}
                  onDragStartPiece={handleDragStartPiece}
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
