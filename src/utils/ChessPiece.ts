import ChessPieceType from './ChessPieceType';

class Piece {
    type: ChessPieceType;
    color: 'dark' | 'light';
    isInCheckState: boolean;

    constructor(type: ChessPieceType, color: 'dark' | 'light', isInCheckState: boolean) {
        this.type = type;
        this.color = color;
        this.isInCheckState = isInCheckState;
    }
}

export default Piece;
