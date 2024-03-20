import chessPiece from "../utils/ChessPiece";
import "../styles/ChessPiece.css"
import Piece from "../utils/ChessPiece";
import ChessPieceType from "../utils/ChessPieceType";

interface ChessSquareProps {
    color: 'dark' | 'light';
    row: number;
    column: number;
    piece?: Piece;
    onSquareClick: (row: number, column: number) => void; // Add this line
}

const ChessSquare: React.FC<ChessSquareProps> = ({ color, row, column, piece, onSquareClick }) => {
    const onDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData("piece", JSON.stringify({ row, column, piece }));
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const onDrop = (e: React.DragEvent, targetRow: number, targetColumn: number) => {
        e.preventDefault();
        const pieceData = e.dataTransfer.getData("piece");
        const { row: startRow, column: startColumn, piece } = JSON.parse(pieceData);
        animatePieceMovement(startRow, startColumn, targetRow, targetColumn, piece);
    };

    const animatePieceMovement = (startRow: number, startColumn: number, endRow: number, endColumn: number, piece: chessPiece) => {
        const startPosition = { x: startColumn * 8, y: startRow * 8 };
        const endPosition = { x: endColumn * 8, y: endRow * 8 };

        const movingPiece = document.createElement("img");
        movingPiece.src = `process.env.PUBLIC_URL + ${piece}.png`;
        movingPiece.style.position = "absolute";
        movingPiece.style.left = `${startPosition.x}px`;
        movingPiece.style.top = `${startPosition.y}px`;
        movingPiece.style.transition = "all 0.5s ease";

        document.body.appendChild(movingPiece);

        setTimeout(() => {
            movingPiece.style.left = `${endPosition.x}px`;
            movingPiece.style.top = `${endPosition.y}px`;
        }, 0);

        setTimeout(() => {
            movingPiece.remove();
        }, 500); //all 0.5s ease sempre o mesmo tempo
    };

    const getSizeClass = (piece: string) => {
        switch (piece) {
            case "black-pawn":
            case "white-pawn":
                return 'small';
            case "black-rook":
            case "white-rook":
            case "black-knight":
            case "white-knight":
            case "black-bishop":
            case "white-bishop":
                return 'medium';
            case "black-queen":
            case "white-queen":
                return 'medium-plus';
            case "black-king":
            case "white-king":
                return 'large';
            default:
                return '';
        }
    };
    return (
        <>
            <div
                className={`chess-square ${color}`}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, row, column)}
            >
                {piece && (
                    <img
                        src={process.env.PUBLIC_URL + `${piece}.png`}
                        alt={"piece"}
                        draggable="true"
                        onDragStart={onDragStart}
                        className={`chess-piece ${getSizeClass(`${piece}`)}`}
                    />
                )}
            </div>
        </>
    );
};

export default ChessSquare;