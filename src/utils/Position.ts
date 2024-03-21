import Piece from './ChessPiece';

class Position {
    row: number;
    column: number;
    squareColor: 'Black' | 'White';
    piece: Piece | undefined;

    constructor(row: number, column: number, squareColor: "Black" | "White", piece: Piece | undefined) {
        this.row = row;
        this.column = column;
        this.squareColor = squareColor;
        this.piece = piece;
    }
}

export default Position;
