import ChessPiece from './ChessPiece'; // Assuming the enum is defined in a separate file

class Piece {
    type: ChessPiece;
    color: 'dark' | 'light';
    isInCheckState: boolean;

    constructor(type: ChessPiece, color: 'dark' | 'light', isInCheckState: boolean) {
        this.type = type;
        this.color = color;
        this.isInCheckState = isInCheckState;
    }
}

export default Piece;
