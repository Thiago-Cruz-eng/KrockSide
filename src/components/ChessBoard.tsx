import React, { useMemo } from 'react';
import '../styles/ChessBoard.css';
import '../styles/ChessSquare.css';
import '../styles/ChessPiece.css';
import { useNavigate, useParams } from 'react-router-dom';
import ChessSquare from './ChessSquare';
import GameResult from './GameResult';
import PlayerCard from './PlayerCard';
import { useChessGame } from '../hooks/useChessGame';
import { useBoardOrientation } from '../hooks/useBoardOrientation';
import { useLastMove } from '../hooks/useLastMove';
import { useSquareSelection } from '../hooks/useSquareSelection';
import { getAssignedColor } from '../service/gameSession';
import { Color, SquareDto, toAlgebraic } from '../types/chess';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/**
 * A tela de partida: tabuleiro, painel dos jogadores e resultado.
 *
 * **O que este componente faz é layout e fiação.** As quatro responsabilidades que ele acumulava
 * saíram para peças próprias, e vale saber onde cada uma está antes de mexer:
 *
 * | Assunto | Onde vive |
 * |---|---|
 * | conversar com o hub (snapshot, lances, eventos) | `useChessGame` |
 * | escolher peça e mover, por clique ou arraste | `useSquareSelection` |
 * | destacar as casas do último lance | `useLastMove` |
 * | ordem de desenho conforme o lado do jogador | `useBoardOrientation` |
 * | cartão de jogador e texto de resultado | `PlayerCard`, `GameResult` |
 *
 * **O servidor é a autoridade.** Nada aqui decide legalidade, turno ou cor. Em particular a cor vem
 * de `getAssignedColor`, alimentada por `JoinRoom` — **nunca** de claim do JWT. Derivar do claim
 * `role` fazia `playerColor` ser sempre `'None'`, `isMyTurn` sempre `false` e as 64 casas ficarem
 * `disabled`: era a DT-01, e o tabuleiro inteiro ficava inerte.
 */
const ChessBoard: React.FC = () => {
  // `roomName` chega DECODIFICADO: o `useParams` do react-router 6 já aplica `decodeURIComponent`
  // em cada segmento. O lobby monta a rota com `encodeURIComponent(room)`, então "sala um" vai
  // como `sala%20um` e volta aqui como "sala um". Não decodifique de novo — `%25` viraria `%`.
  const { roomName, id } = useParams<{ roomName: string; id: string }>();
  const navigate = useNavigate();

  const {
    squares,
    currentTurn,
    highlighted,
    loading,
    waitingForOpponent,
    outcome,
    winner,
    error,
    lastMoveError,
    requestPossibleMoves,
    makeMove,
    clearHighlights,
    leaveRoom,
  } = useChessGame(roomName);

  /**
   * Volta ao lobby liberando o assento na sala. Não é logout: a sessão continua; só a partida é
   * abandonada. `LeaveRoom` avisa o adversário via `PlayerLeft`.
   */
  const handleLeave = async () => {
    await leaveRoom();
    navigate(`/chess-lobby/${encodeURIComponent(id ?? '')}`);
  };

  // A cor vem do servidor, atribuída em JoinRoom e guardada pelo lobby por sala.
  const playerColor: Color = useMemo(() => getAssignedColor(roomName), [roomName]);

  const isFinished = outcome !== 'InProgress';
  const isMyTurn = !isFinished && playerColor !== 'None' && playerColor === currentTurn;

  const { selected, isOwnPiece, handleSelect, handleDragStartPiece, handleDropPiece } =
    useSquareSelection({
      playerColor,
      highlighted,
      requestPossibleMoves,
      makeMove,
      clearHighlights,
    });

  const lastMove = useLastMove(squares);
  const { cols, rows } = useBoardOrientation(playerColor);

  /** Índice por notação, para achar a casa em tempo constante durante o render. */
  const squareIndex = useMemo(() => {
    const map = new Map<string, SquareDto>();
    squares.forEach((sq) => map.set(sq.algebraic, sq));
    return map;
  }, [squares]);

  // Casa do rei em xeque, para o destaque radial. Quem marca `isInCheckState` é o backend.
  const checkedKingSquare = useMemo(
    () =>
      squares.find((sq) => sq.piece?.type === 'King' && sq.piece.isInCheckState)?.algebraic ?? null,
    [squares],
  );

  if (loading) {
    return (
      <div className="game__loading">
        <div className="waiting__spinner" />
        <span>Carregando partida…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game">
        <div className="alert" role="alert">
          Erro: {error}
        </div>
        <button className="btn" onClick={handleLeave}>
          Voltar ao lobby
        </button>
      </div>
    );
  }

  const opponentColor: Color = playerColor === 'White' ? 'Black' : 'White';

  return (
    <div className="game">
      <header className="game__header">
        <div className="game__room">
          <span className="game__room-label">Sala</span>
          <span className="game__room-name">{roomName}</span>
        </div>
        <div className="game__header-actions">
          {/* Mantidos como testids: a suíte lê o turno e a cor por eles. */}
          <span className="visually-hidden" data-testid="current-turn">
            Turno: {currentTurn}
          </span>
          <span className="visually-hidden" data-testid="player-color">
            Você: {playerColor}
          </span>
          <button className="btn btn--ghost" onClick={handleLeave}>
            Sair da partida
          </button>
        </div>
      </header>

      {/* Mensagem do último lance recusado. Vem do servidor — não é texto inventado aqui. */}
      {lastMoveError && (
        <div className="alert" role="alert">
          {lastMoveError}
        </div>
      )}

      <div className="game__body">
        <div className="board-frame">
          <div className={`chessboard${isFinished ? ' chessboard--finished' : ''}`}>
            {cols.map((col) =>
              rows.map((row) => {
                const algebraic = toAlgebraic(row, col);
                const square = squareIndex.get(algebraic) ?? emptySquare(algebraic, row, col);

                // Coordenadas só na borda visível: fileira à esquerda, arquivo embaixo. Como
                // `rows`/`cols` já vêm na ordem de desenho, comparar com a primeira e a última
                // posição funciona nas duas orientações.
                const isFirstColumn = row === rows[0];
                const isLastRow = col === cols[cols.length - 1];

                return (
                  <ChessSquare
                    key={algebraic}
                    square={square}
                    highlighted={highlighted.has(algebraic)}
                    selected={selected === algebraic}
                    lastMove={lastMove.has(algebraic)}
                    inCheck={checkedKingSquare === algebraic}
                    disabled={!isMyTurn}
                    canDrag={isMyTurn && isOwnPiece(square.piece)}
                    rankLabel={isFirstColumn ? 8 - col : null}
                    fileLabel={isLastRow ? FILES[row] : null}
                    onSelect={handleSelect}
                    onDropPiece={handleDropPiece}
                    onDragStartPiece={handleDragStartPiece}
                  />
                );
              }),
            )}
          </div>
        </div>

        <aside className="panel">
          <PlayerCard
            color={opponentColor}
            isYou={false}
            isActive={currentTurn === opponentColor}
            isFinished={isFinished}
          />
          <PlayerCard
            color={playerColor}
            isYou
            isActive={currentTurn === playerColor}
            isFinished={isFinished}
          />

          {waitingForOpponent && (
            <div className="waiting" data-testid="waiting-opponent">
              <span className="waiting__spinner" />
              Aguardando adversário…
            </div>
          )}

          <GameResult outcome={outcome} winner={winner} playerColor={playerColor} />
        </aside>
      </div>
    </div>
  );
};

/**
 * Casa vazia sintética, para quando o snapshot não traz aquela notação.
 *
 * **Isto mascara um erro de contrato, e é débito registrado (DT-13).** O backend sempre envia as 64
 * casas; faltar alguma significa snapshot incompleto, e o certo seria reportar em vez de desenhar um
 * tabuleiro plausível e vazio. Está mantido porque removê-lo troca "tabuleiro estranho" por "tela de
 * erro" sem que ninguém tenha decidido isso.
 */
function emptySquare(algebraic: string, row: number, column: number): SquareDto {
  return {
    algebraic,
    file: algebraic[0],
    rank: parseInt(algebraic.slice(1), 10),
    row,
    column,
    squareColor: (row + column) % 2 === 0 ? 'White' : 'Black',
    piece: null,
  };
}

export default ChessBoard;
