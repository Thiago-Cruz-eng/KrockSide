import chessPiece from "../utils/ChessPiece";

interface ChessSquareProps {
    color: 'dark' | 'light';
    row: number;
    column: number;
    piece?: chessPiece;
    onSquareClick: (row: number, column: number) => void; // Add this line
}

const ChessSquare: React.FC<ChessSquareProps> = ({ color, row, column, piece, onSquareClick }) => {
    // Drag start handler
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
        movingPiece.src = `path_to_images/${piece}.png`;
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

    return (
        <div
            className={`chess-square ${color}`}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, row, column)}
        >
            {piece && (
                <img
                    src={`path_to_images/${piece}.png`}
                    alt={"piece"}
                    draggable="true"
                    onDragStart={onDragStart}
                />
            )}
        </div>

    );
};

export default ChessSquare;