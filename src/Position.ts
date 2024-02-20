import ChessPiece from './ChessPiece'; // Assuming the enum is defined in a separate file
import Piece from './ChessPiece'; // Assuming the Piece class is defined in a separate file

class Position {
    row: number;
    column: number;
    squareColor: 'dark' | 'light';
    piece: Piece | null;

    constructor(row: number, column: number, squareColor: 'dark' | 'light', piece: Piece | null) {
        this.row = row;
        this.column = column;
        this.squareColor = squareColor;
        this.piece = piece;
    }
}

export default Position;
