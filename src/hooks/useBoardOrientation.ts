import { useMemo } from 'react';
import { Color } from '../types/chess';

const BOARD_SIZE = 8;

export interface BoardOrientation {
  /** Índices de coluna na ordem de desenho. Coluna é a **fileira** do tabuleiro. */
  cols: number[];
  /** Índices de linha na ordem de desenho. Linha é o **arquivo** do tabuleiro. */
  rows: number[];
  /** Verdadeiro quando o tabuleiro está visto do lado das pretas. */
  flipped: boolean;
}

/**
 * Em que ordem as casas são desenhadas, para que cada jogador veja o tabuleiro do seu lado.
 *
 * **A convenção de coordenadas do backend é contraintuitiva** e é a origem da confusão aqui:
 * `row` (0..7) é o **arquivo** (`a`..`h`) e `column` (0..7) é a **fileira**, numerada ao contrário
 * — `column = 0` é a fileira 8. A consequência prática é boa: a ordem natural 0→7 nos dois eixos
 * já desenha o tabuleiro da perspectiva das **brancas**, com a fileira 8 no topo e o arquivo `a`
 * à esquerda.
 *
 * Para as pretas, inverter as duas ordens basta. Não fazer isso era a DT-09: quem jogava de pretas
 * via o tabuleiro de cabeça para baixo.
 *
 * Este hook decide apenas a **ordem de iteração** do grid. Ele não mexe em coordenada nenhuma: a
 * casa `e2` continua sendo `e2` para os dois jogadores, e o que muda é só onde ela aparece na tela.
 * Converter índice em notação continua sendo trabalho de `toAlgebraic`, nunca de aritmética inline.
 *
 * @param playerColor Cor atribuída pelo servidor em `JoinRoom`. `'None'` cai no layout das brancas.
 */
export function useBoardOrientation(playerColor: Color): BoardOrientation {
  const flipped = playerColor === 'Black';

  // Um `useMemo` por eixo, e não um objeto memoizado inteiro, porque `cols` e `rows` são passados
  // adiante e recriá-los a cada render invalidaria memoização de quem os consome.
  const cols = useMemo(() => range(flipped), [flipped]);
  const rows = useMemo(() => range(flipped), [flipped]);

  return { cols, rows, flipped };
}

/** `[0..7]`, ou `[7..0]` quando o tabuleiro está invertido. */
function range(reversed: boolean): number[] {
  const ascending = Array.from({ length: BOARD_SIZE }, (_, index) => index);
  return reversed ? [...ascending].reverse() : ascending;
}
