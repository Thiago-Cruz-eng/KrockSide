import { useCallback, useRef, useState } from 'react';
import { Color, MakeMoveResponse, PieceDto, PossibleMovesResponse } from '../types/chess';

export interface UseSquareSelectionArgs {
  /** Cor do jogador, atribuída pelo servidor. Decide o que é "peça sua". */
  playerColor: Color;
  /** Destinos legais que o servidor devolveu para a peça selecionada. */
  highlighted: Set<string>;
  requestPossibleMoves: (from: string) => Promise<PossibleMovesResponse>;
  makeMove: (from: string, to: string) => Promise<MakeMoveResponse>;
  clearHighlights: () => void;
}

export interface SquareSelectionApi {
  /** Casa selecionada, para pintar a origem. `null` quando não há seleção. */
  selected: string | null;
  /** A peça é do jogador? Usado também para decidir se ela pode ser arrastada. */
  isOwnPiece: (piece: PieceDto | null) => boolean;
  /** Clique numa casa. */
  handleSelect: (algebraic: string, piece: PieceDto | null) => Promise<void>;
  /** Início de arraste de uma peça. */
  handleDragStartPiece: (algebraic: string) => void;
  /** Soltura de uma peça sobre uma casa. */
  handleDropPiece: (from: string, to: string) => Promise<void>;
}

/**
 * Toda a interação de escolher peça e mover — por clique ou por arraste.
 *
 * Estava dentro de `ChessBoard`, que acumulava cinco responsabilidades. Aqui fica só esta, e o
 * componente volta a ser layout e fiação.
 *
 * **O servidor continua sendo a autoridade.** Nada aqui decide se um lance é legal: `highlighted`
 * são os destinos que o servidor já devolveu, e a checagem contra ele serve apenas para a interface
 * não propor um lance que ela **já sabe** que será recusado. `makeMove` é enviado e o servidor
 * decide; o tabuleiro nunca é atualizado de forma otimista.
 */
export function useSquareSelection({
  playerColor,
  highlighted,
  requestPossibleMoves,
  makeMove,
  clearHighlights,
}: UseSquareSelectionArgs): SquareSelectionApi {
  const [selected, setSelectedState] = useState<string | null>(null);

  /**
   * A seleção espelhada num ref.
   *
   * Dois cliques rápidos chegam antes de o React re-renderizar: o handler do segundo clique ainda
   * enxergava `selected` nulo, tratava o destino como nova seleção e **o lance sumia sem aviso**.
   * Quem joga rápido perdia jogadas.
   *
   * O estado continua existindo porque é o que pinta a casa; o ref é o que decide.
   */
  const selectedRef = useRef<string | null>(null);

  const setSelected = useCallback((value: string | null) => {
    selectedRef.current = value;
    setSelectedState(value);
  }, []);

  const isOwnPiece = useCallback(
    (piece: PieceDto | null) =>
      piece !== null && piece.type !== 'None' && piece.color === playerColor,
    [playerColor],
  );

  /** Seleciona a casa e pede ao servidor os destinos legais dela. */
  const selectSquare = useCallback(
    async (algebraic: string) => {
      setSelected(algebraic);
      await requestPossibleMoves(algebraic);
    },
    [requestPossibleMoves, setSelected],
  );

  /** Desfaz a seleção e apaga os destaques. */
  const clearSelection = useCallback(() => {
    setSelected(null);
    clearHighlights();
  }, [clearHighlights, setSelected]);

  /**
   * Destino está fora dos destaques que o servidor devolveu?
   *
   * `highlighted.size === 0` significa que os destaques ainda não chegaram — nesse caso deixa
   * passar e é o servidor que recusa. Bloquear aqui faria a jogada se perder quando a resposta
   * estivesse em trânsito.
   */
  const isKnownIllegal = useCallback(
    (to: string) => highlighted.size > 0 && !highlighted.has(to),
    [highlighted],
  );

  const handleSelect = useCallback(
    async (algebraic: string, piece: PieceDto | null) => {
      const current = selectedRef.current;

      if (current && current !== algebraic) {
        // Clicar em OUTRA peça sua troca a seleção. Antes limpava tudo e obrigava um segundo
        // clique para escolher outra peça — atrito que nenhuma interface de xadrez tem. Nunca é
        // um lance: não se captura peça da própria cor.
        if (isOwnPiece(piece)) {
          await selectSquare(algebraic);
          return;
        }

        // Segundo clique num destino: tenta o lance.
        if (isKnownIllegal(algebraic)) {
          clearSelection();
          return;
        }

        const result = await makeMove(current, algebraic);
        setSelected(null);
        if (!result.success) clearHighlights();
        return;
      }

      // Primeiro clique. Em casa vazia ou em peça do adversário, apenas limpa.
      if (!isOwnPiece(piece)) {
        clearSelection();
        return;
      }

      await selectSquare(algebraic);
    },
    [
      isOwnPiece,
      isKnownIllegal,
      selectSquare,
      clearSelection,
      makeMove,
      clearHighlights,
      setSelected,
    ],
  );

  /**
   * Busca os destinos legais assim que o arrasto começa, para que a soltura já tenha com o que se
   * comparar.
   */
  const handleDragStartPiece = useCallback(
    (algebraic: string) => {
      setSelected(algebraic);
      void requestPossibleMoves(algebraic);
    },
    [requestPossibleMoves, setSelected],
  );

  const handleDropPiece = useCallback(
    async (from: string, to: string) => {
      if (isKnownIllegal(to)) {
        clearSelection();
        return;
      }

      await makeMove(from, to);

      // Note a assimetria com `handleSelect`: ali um lance recusado também chama
      // `clearHighlights()`, e aqui não. A diferença é herdada e provavelmente incidental — o
      // efeito visível é que, após um arraste recusado, os destaques da peça continuam na tela.
      // Preservada ao extrair este hook para não mudar comportamento junto com estrutura; se for
      // unificar, unifique nos dois sentidos e ajuste os testes de interação.
      setSelected(null);
    },
    [isKnownIllegal, clearSelection, makeMove, setSelected],
  );

  return { selected, isOwnPiece, handleSelect, handleDragStartPiece, handleDropPiece };
}
