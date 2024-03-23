import Piece from './ChessPiece';

class Position {
    row: number;
    column: number;
    squareColor: string |undefined | null;
    piece: Piece | undefined | null;

    constructor(row: number, column: number, squareColor: string | null | undefined, piece: Piece | undefined | null) {
        this.row = row;
        this.column = column;
        this.squareColor = squareColor;
        this.piece = piece;
    }
}

export default Position;
