import chessPiece from "../utils/ChessPiece";
import "../styles/ChessPiece.css"
import Piece from "../utils/ChessPiece";
import ChessPieceType from "../utils/ChessPieceType";
import {useRef, useState} from "react";
import * as signalR from "@microsoft/signalr";

interface ChessSquareProps {
    color: 'dark' | 'light';
    row: number;
    column: number;
    piece?: Piece;
    onSquareClick: (row: number, column: number) => void;
}

const ChessSquare: React.FC<ChessSquareProps> = ({ color, row, column, piece, onSquareClick }) => {
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
    const squareRef = useRef<HTMLDivElement>(null);

    const handleSquareClick = async (row: number, column: number) => {
        try {
            if(connection){
                const response = await connection.invoke("sendMove", { row, column });
                if (response) {
                    console.log(response);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const onDragStart = (e: React.DragEvent) => {
        console.log("inciei o movimento")
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

    const animatePieceMovement = (startRow: number, startColumn: number, endRow: number, endColumn: number, piece: Piece) => {
        console.log(startRow, startColumn, endRow, endColumn)
        const startPosition = squareRef.current?.getBoundingClientRect();
        if (!startPosition) return;

        const movingPiece = document.createElement("img");
        movingPiece.src = `${process.env.PUBLIC_URL}/${piece}.png`;
        movingPiece.style.position = "absolute";
        movingPiece.style.left = `${startPosition.left}px`;
        movingPiece.style.top = `${startPosition.top}px`;
        movingPiece.style.transition = "all 0.5s ease";

        document.body.appendChild(movingPiece);

        setTimeout(() => {
            const endPosition = squareRef.current?.getBoundingClientRect();
            if (!endPosition) return;
            movingPiece.style.left = `${endPosition.left}px`;
            movingPiece.style.top = `${endPosition.top}px`;
        }, 0);

        setTimeout(() => {
            movingPiece.remove();
        }, 500);
    };

    const NoClickRapa = (row: number, column: number) => {
        var x = onSquareClick(row, column)
        console.log(row,column)
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
                onClick={() => NoClickRapa(row, column)}
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