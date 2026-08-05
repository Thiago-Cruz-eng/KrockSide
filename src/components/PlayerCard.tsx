import React from 'react';
import { Color } from '../types/chess';

export interface PlayerCardProps {
  /** Lado que este cartão representa. */
  color: Color;
  /** Este cartão é do jogador local? Decide entre "Você" e "Adversário". */
  isYou: boolean;
  /** É a vez desta cor e a partida está em andamento. */
  isActive: boolean;
  /** A partida terminou — nenhum dos dois lados está jogando. */
  isFinished: boolean;
}

/**
 * Cartão de um dos dois jogadores: quem é, de que cor joga e se está na vez.
 *
 * Extraído de `ChessBoard`, onde era uma função interna que fechava sobre `currentTurn` e
 * `isFinished`. Como componente com props explícitas, o que ele depende fica declarado — e ele passa
 * a ser testável sem montar o tabuleiro inteiro.
 *
 * Puramente apresentacional: não sabe de hub, de sala nem de lance.
 */
const PlayerCard: React.FC<PlayerCardProps> = ({ color, isYou, isActive, isFinished }) => {
  // A partida encerrada vence a vez: com xeque-mate no tabuleiro, ninguém está "jogando agora".
  const active = !isFinished && isActive;
  const isWhite = color === 'White';

  return (
    <div className={`player-card${active ? ' player-card--active' : ''}`}>
      <span
        className={`player-card__avatar player-card__avatar--${isWhite ? 'white' : 'black'}`}
        // O rei unicode é decorativo: a informação de cor já está no texto ao lado, e sem isto o
        // leitor de tela anunciaria "rei branco" onde o dado útil é "Você · Brancas".
        aria-hidden="true"
      >
        {isWhite ? '♔' : '♚'}
      </span>

      <span className="player-card__info">
        <span className="player-card__name">
          {isYou ? 'Você' : 'Adversário'} · {isWhite ? 'Brancas' : 'Pretas'}
        </span>
        <span className={`player-card__state${active ? ' player-card__state--turn' : ''}`}>
          {isFinished ? 'Partida encerrada' : active ? 'Jogando agora' : 'Aguardando'}
        </span>
      </span>
    </div>
  );
};

export default PlayerCard;
