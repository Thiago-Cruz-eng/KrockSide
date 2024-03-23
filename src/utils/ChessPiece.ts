import ChessPieceType from './ChessPieceType';

interface Piece {
    Type: string;
    Color: string;
    IsInCheckState: boolean;
}

export default Piece;
