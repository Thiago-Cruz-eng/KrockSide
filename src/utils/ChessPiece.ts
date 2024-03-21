import ChessPieceType from './ChessPieceType';

class Piece {
    type: ChessPieceType;
    color: 'Black' | 'White' = "Black";
    isInCheckState: boolean;

    constructor(type: ChessPieceType, color: 'Black' | 'White', isInCheckState: boolean) {
        this.type = type;
        this.color = color;
        this.isInCheckState = isInCheckState;
    }
}

export default Piece;
