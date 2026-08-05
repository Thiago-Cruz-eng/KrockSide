import React from 'react';
import { Color, GameOutcome } from '../types/chess';

export interface GameResultProps {
  /** Situação da partida, como o servidor a apurou. */
  outcome: GameOutcome;
  /** Cor vencedora no xeque-mate; `null` no afogamento e enquanto a partida corre. */
  winner: Color | null;
  /** Cor do jogador local, para escrever "você ganhou" em vez de "as brancas ganharam". */
  playerColor: Color;
}

/**
 * Painel de fim de partida. Não renderiza nada enquanto a partida está em andamento.
 *
 * Quem decide o resultado é o **servidor**: `outcome` e `winner` vêm do snapshot e do evento
 * `GameOver`. Este componente só traduz isso em texto — não avalia xeque-mate nem afogamento, o que
 * seria trazer regra de xadrez para o cliente.
 *
 * O `data-testid="game-result"` é lido pela suíte; mantenha.
 */
const GameResult: React.FC<GameResultProps> = ({ outcome, winner, playerColor }) => {
  const title = describeOutcome(outcome, winner, playerColor);
  if (title === null) return null;

  return (
    <div className="result" data-testid="game-result" role="status">
      <span className="result__title">{title}</span>
      <span className="result__detail">
        {outcome === 'Stalemate'
          ? 'Sem lance legal e sem xeque.'
          : 'Nenhum lance é aceito a partir daqui.'}
      </span>
    </div>
  );
};

/**
 * O texto do resultado, ou `null` quando a partida não acabou.
 *
 * A ordem dos casos importa: o afogamento é testado primeiro porque nele não há vencedor, e só
 * depois o xeque-mate, que tem três redações possíveis conforme quem ganhou.
 *
 * O último caso — xeque-mate sem `winner` — não deveria acontecer, já que o servidor sempre envia a
 * cor vencedora junto do mate. Existe para não devolver texto vazio se o campo faltar num payload
 * antigo.
 */
function describeOutcome(
  outcome: GameOutcome,
  winner: Color | null,
  playerColor: Color,
): string | null {
  if (outcome === 'Stalemate') return 'Empate por afogamento';
  if (outcome !== 'Checkmate') return null;

  if (winner === playerColor) return 'Xeque-mate — você ganhou!';
  if (winner) return `Xeque-mate — ${winner === 'White' ? 'as brancas' : 'as pretas'} ganharam`;

  return 'Xeque-mate';
}

export default GameResult;
