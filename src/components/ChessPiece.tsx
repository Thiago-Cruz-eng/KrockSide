import React from 'react';
import { Color, PieceType } from '../types/chess';

/**
 * Peça de xadrez desenhada com o glifo Unicode sólido, colorido por CSS.
 *
 * Substituiu os doze PNGs de `public/` (≈150 KB cada, 1,8 MB no total, servidos em
 * tamanho pequeno). O glifo escala sem perder nitidez em qualquer tamanho de tabuleiro,
 * não custa requisição, e a cor sai do tema — as brancas são preenchimento claro com
 * contorno escuro, as pretas o inverso, o que dá um conjunto coerente em vez de dois
 * desenhos diferentes.
 *
 * Sempre o glifo SÓLIDO para os dois lados. O par vazado/sólido do Unicode (♙ vs ♟)
 * tem peso visual muito diferente entre fontes, e o vazado desaparece em tabuleiro claro.
 */

const GLYPH: Record<Exclude<PieceType, 'None'>, string> = {
  King: '♚',
  Queen: '♛',
  Rook: '♜',
  Bishop: '♝',
  Knight: '♞',
  Pawn: '♟',
};

/**
 * Nome legível para leitor de tela — e é por ele que os testes encontram a peça.
 * O gênero vai junto porque "Dama branco" fica errado: Torre e Dama são femininas.
 */
const PT_NAME: Record<Exclude<PieceType, 'None'>, { noun: string; feminine: boolean }> = {
  King: { noun: 'Rei', feminine: false },
  Queen: { noun: 'Dama', feminine: true },
  Rook: { noun: 'Torre', feminine: true },
  Bishop: { noun: 'Bispo', feminine: false },
  Knight: { noun: 'Cavalo', feminine: false },
  Pawn: { noun: 'Peão', feminine: false },
};

export function pieceLabel(type: Exclude<PieceType, 'None'>, color: 'White' | 'Black'): string {
  const { noun, feminine } = PT_NAME[type];
  const adjective = color === 'White' ? (feminine ? 'branca' : 'branco') : feminine ? 'preta' : 'preto';
  return `${noun} ${adjective}`;
}

export interface ChessPieceProps {
  type: PieceType;
  color: Color;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

const ChessPiece: React.FC<ChessPieceProps> = ({ type, color, draggable, onDragStart }) => {
  if (type === 'None' || color === 'None') return null;

  const glyph = GLYPH[type];
  const label = pieceLabel(type, color);

  return (
    <span
      className={`piece piece--${color.toLowerCase()}`}
      role="img"
      aria-label={label}
      title={label}
      draggable={draggable}
      onDragStart={onDragStart}
      data-piece={`${color}-${type}`}
    >
      {glyph}
    </span>
  );
};

export default ChessPiece;
