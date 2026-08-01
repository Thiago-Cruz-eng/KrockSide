import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../styles/ChessBoard.css';
import '../styles/ChessSquare.css';
import '../styles/ChessPiece.css';
import { useNavigate, useParams } from 'react-router-dom';
import ChessSquare from './ChessSquare';
import { useChessGame } from '../hooks/useChessGame';
import { getAssignedColor } from '../service/gameSession';
import { Color, PieceDto, SquareDto, toAlgebraic } from '../types/chess';

const BOARD_SIZE = 8;
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const ChessBoard: React.FC = () => {
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
  } = useChessGame(roomName);

  /**
   * Casa selecionada. Espelhada num ref porque dois cliques rápidos chegam antes de o
   * React re-renderizar: o handler do segundo clique ainda enxergava `selected` nulo,
   * tratava o destino como nova seleção e o lance sumia sem aviso. Quem joga rápido
   * perdia jogadas.
   *
   * O estado continua existindo porque é o que pinta a casa; o ref é o que decide.
   */
  const [selected, setSelectedState] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const setSelected = useCallback((value: string | null) => {
    selectedRef.current = value;
    setSelectedState(value);
  }, []);

  // A cor vem do servidor, atribuída em JoinRoom e guardada pelo lobby. Antes era
  // derivada do claim `role` do JWT, que carrega o papel de autorização ("jogador"),
  // nunca uma cor de peça: playerColor era sempre 'None' e o tabuleiro ficava inerte.
  const playerColor: Color = useMemo(() => getAssignedColor(roomName), [roomName]);

  const isFinished = outcome !== 'InProgress';
  const isMyTurn = !isFinished && playerColor !== 'None' && playerColor === currentTurn;

  const squareIndex = useMemo(() => {
    const map = new Map<string, SquareDto>();
    squares.forEach((sq) => map.set(sq.algebraic, sq));
    return map;
  }, [squares]);

  // Casa do rei em xeque, para o destaque radial. O backend marca isInCheckState na peça.
  const checkedKingSquare = useMemo(
    () =>
      squares.find((sq) => sq.piece?.type === 'King' && sq.piece.isInCheckState)?.algebraic ??
      null,
    [squares],
  );

  /**
   * Casas do último lance aplicado.
   *
   * Derivado comparando o snapshot novo com o anterior: as duas casas que mudaram de
   * ocupante são a origem e o destino. Evita depender do payload de BoardChanged, que
   * não chega para quem entra no meio da partida.
   */
  const previous = useRef<Map<string, string> | null>(null);
  const [lastMove, setLastMove] = useState<Set<string>>(new Set());

  useEffect(() => {
    const current = new Map(
      squares.map((sq) => [sq.algebraic, sq.piece ? `${sq.piece.color}${sq.piece.type}` : '']),
    );
    const before = previous.current;
    previous.current = current;
    if (!before || before.size === 0) return;

    const changed = [...current.entries()]
      .filter(([sq, val]) => before.get(sq) !== val)
      .map(([sq]) => sq);

    // Um lance normal muda exatamente duas casas. Mais que isso é recarga de snapshot.
    if (changed.length === 2) setLastMove(new Set(changed));
  }, [squares]);

  const isOwnPiece = useCallback(
    (piece: PieceDto | null) =>
      piece !== null && piece.type !== 'None' && piece.color === playerColor,
    [playerColor],
  );

  const handleSelect = useCallback(
    async (algebraic: string, piece: PieceDto | null) => {
      const current = selectedRef.current;

      if (current && current !== algebraic) {
        // Clicar em OUTRA peça sua troca a seleção. Antes limpava tudo e obrigava um
        // segundo clique para escolher outra peça — atrito que nenhuma interface de xadrez
        // tem. Nunca é um lance: não se captura peça da própria cor.
        if (isOwnPiece(piece)) {
          setSelected(algebraic);
          await requestPossibleMoves(algebraic);
          return;
        }

        // Segundo clique num destino: tenta o lance, desde que esteja entre os que o
        // servidor devolveu como legais.
        if (highlighted.size > 0 && !highlighted.has(algebraic)) {
          setSelected(null);
          clearHighlights();
          return;
        }
        const result = await makeMove(current, algebraic);
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
    [highlighted, makeMove, isOwnPiece, requestPossibleMoves, clearHighlights, setSelected],
  );

  // Busca os destinos legais assim que o arrasto começa, para que a soltura já tenha
  // com o que se comparar.
  const handleDragStartPiece = useCallback(
    (algebraic: string) => {
      setSelected(algebraic);
      void requestPossibleMoves(algebraic);
    },
    [requestPossibleMoves, setSelected],
  );

  const handleDropPiece = useCallback(
    async (from: string, to: string) => {
      // O servidor continua sendo a autoridade — isto só impede a UI de propor um lance
      // que ela já sabe ser ilegal. Se os destaques ainda não chegaram, deixa passar.
      if (highlighted.size > 0 && !highlighted.has(to)) {
        setSelected(null);
        clearHighlights();
        return;
      }
      await makeMove(from, to);
      setSelected(null);
    },
    [makeMove, highlighted, clearHighlights, setSelected],
  );

  /**
   * Ordem de desenho das casas.
   *
   * As colunas internas vão de 0 (fileira 8) a 7 (fileira 1), e as linhas de 0 (arquivo a)
   * a 7 (arquivo h) — ou seja, a ordem natural já mostra o tabuleiro do ponto de vista das
   * brancas. Para as pretas invertemos as duas, que era a DT-09: o tabuleiro ficava de
   * cabeça para baixo para quem jogava de preto.
   */
  const flipped = playerColor === 'Black';
  const cols = useMemo(() => {
    const range = Array.from({ length: BOARD_SIZE }, (_, i) => i);
    return flipped ? [...range].reverse() : range;
  }, [flipped]);
  const rows = useMemo(() => {
    const range = Array.from({ length: BOARD_SIZE }, (_, i) => i);
    return flipped ? [...range].reverse() : range;
  }, [flipped]);

  const resultText = useMemo(() => {
    if (outcome === 'Stalemate') return 'Empate por afogamento';
    if (outcome !== 'Checkmate') return null;
    if (winner === playerColor) return 'Xeque-mate — você ganhou!';
    if (winner) return `Xeque-mate — ${winner === 'White' ? 'as brancas' : 'as pretas'} ganharam`;
    return 'Xeque-mate';
  }, [outcome, winner, playerColor]);

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
        <button className="btn" onClick={() => navigate(`/chess-lobby/${id}`)}>
          Voltar ao lobby
        </button>
      </div>
    );
  }

  const opponentColor: Color = playerColor === 'White' ? 'Black' : 'White';

  const playerCard = (color: Color, isYou: boolean) => {
    const active = !isFinished && currentTurn === color;
    return (
      <div className={`player-card${active ? ' player-card--active' : ''}`}>
        <span
          className={`player-card__avatar player-card__avatar--${
            color === 'White' ? 'white' : 'black'
          }`}
          aria-hidden="true"
        >
          {color === 'White' ? '♔' : '♚'}
        </span>
        <span className="player-card__info">
          <span className="player-card__name">
            {isYou ? 'Você' : 'Adversário'} · {color === 'White' ? 'Brancas' : 'Pretas'}
          </span>
          <span className={`player-card__state${active ? ' player-card__state--turn' : ''}`}>
            {isFinished ? 'Partida encerrada' : active ? 'Jogando agora' : 'Aguardando'}
          </span>
        </span>
      </div>
    );
  };

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
          <button className="btn btn--ghost" onClick={() => navigate(`/chess-lobby/${id}`)}>
            Sair da partida
          </button>
        </div>
      </header>

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

                // Coordenadas só na borda visível: fileira à esquerda, arquivo embaixo.
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
          {playerCard(opponentColor, false)}
          {playerCard(playerColor, true)}

          {waitingForOpponent && (
            <div className="waiting" data-testid="waiting-opponent">
              <span className="waiting__spinner" />
              Aguardando adversário…
            </div>
          )}

          {resultText && (
            <div className="result" data-testid="game-result" role="status">
              <span className="result__title">{resultText}</span>
              <span className="result__detail">
                {outcome === 'Stalemate'
                  ? 'Sem lance legal e sem xeque.'
                  : 'Nenhum lance é aceito a partir daqui.'}
              </span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default ChessBoard;
