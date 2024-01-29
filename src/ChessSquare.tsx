// ChessSquare.tsx
import React from 'react';

interface ChessSquareProps {
    color: string;
    type?: string; // You can add more specific types like 'pawn', 'rook', etc.
    column: string;
    row: number;
}

const ChessSquare: React.FC<ChessSquareProps> = ({ color, type, column, row }) => {
    return (
        <div className={`square ${color}`}>
    {type && <div className={`piece ${type}`}>{/* Piece SVG or text representation */}</div>}
        </div>
    );
    };

    export default ChessSquare;
