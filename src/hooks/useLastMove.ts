import { useEffect, useRef, useState } from 'react';
import { SquareDto } from '../types/chess';

/**
 * Descobre quais duas casas mudaram no último lance, comparando o snapshot novo com o anterior.
 *
 * O `ChessBoard` usa o resultado para destacar origem e destino da jogada que acabou de acontecer.
 *
 * **Por que derivar em vez de ler do evento.** O payload de `BoardChanged` traz `from` e `to`
 * prontos, mas ele só chega para quem já estava na sala quando o lance foi feito. Quem entra no
 * meio da partida — ou quem recarrega a página — recebe apenas o snapshot, sem evento nenhum.
 * Comparar dois snapshots funciona nos dois casos.
 *
 * **Por que exatamente duas casas.** Um lance normal muda o ocupante de duas casas: a origem fica
 * vazia e o destino ganha a peça. Captura também são duas (a peça capturada desaparece junto com o
 * destino ser reocupado). Mais que duas significa que o tabuleiro foi recarregado inteiro — início
 * de partida, ou reconexão — e nesse caso não há "último lance" a destacar, então o valor anterior
 * é mantido em vez de exibir algo errado.
 *
 * Quando o roque entrar no jogo, ele moverá **quatro** casas e cairá justamente nesse caso — o
 * destaque simplesmente não aparecerá. É o comportamento seguro, mas é onde mexer.
 *
 * @param squares As 64 casas do snapshot corrente.
 * @returns As casas do último lance, em notação algébrica. Vazio até o primeiro lance.
 */
export function useLastMove(squares: SquareDto[]): Set<string> {
  /**
   * Ocupante de cada casa no snapshot anterior, como `"WhitePawn"` ou `""`.
   *
   * Fica num ref, e não em estado: mudá-lo não deve provocar render — ele existe só para ser
   * comparado no próximo snapshot.
   */
  const previous = useRef<Map<string, string> | null>(null);
  const [lastMove, setLastMove] = useState<Set<string>>(new Set());

  useEffect(() => {
    const current = new Map(
      squares.map((sq) => [sq.algebraic, sq.piece ? `${sq.piece.color}${sq.piece.type}` : '']),
    );

    const before = previous.current;
    previous.current = current;

    // Primeiro snapshot da sessão: não há com o que comparar.
    if (!before || before.size === 0) return;

    const changed = [...current.entries()]
      .filter(([square, occupant]) => before.get(square) !== occupant)
      .map(([square]) => square);

    // Ver a nota da função sobre por que só duas casas contam.
    if (changed.length === 2) setLastMove(new Set(changed));
  }, [squares]);

  return lastMove;
}
