import "../styles/ChessPiece.css"
import Piece from "../utils/ChessPiece";
import {useEffect, useRef, useState} from "react";
import * as signalR from "@microsoft/signalr";
import position from "../utils/Position";
import {useSignalR} from "./SignalRContext";
import ChessPiece from "../utils/ChessPiece";
import chessPiece from "../utils/ChessPiece";
import Position from "../utils/Position";

interface ChessSquareProps {
    color: string;
    row: number;
    column: number;
    piece?: Piece;
    pieceName: string
}

const ChessSquare: React.FC<ChessSquareProps> = ({ color, row, column, piece ,pieceName}) => {
    const squareRef = useRef<HTMLDivElement>(null);
    const connectionOfWebSocket = useSignalR();
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);

    useEffect(() => {
        setConnection(connectionOfWebSocket);
    }, []);

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

    const NoClickRapa = async (row: number, column: number, piece: Piece | undefined) => {
        try {
            console.log(connection)

            let x = "ahla"

            console.log(piece)
            if(connection){
                // sconsole.log(pos)
                // const response = await connection.invoke("SendPossiblesMove", { x, pos });
                // if (response) {
                //     console.log(response);
                // }
            }
        } catch (err) {
            console.error(err);
        }
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
                onClick={() => NoClickRapa(row, column, piece)}
            >
                {piece && (
                    <img
                        src={process.env.PUBLIC_URL + `${piece.Color}-${piece.Type}.png`}
                        alt={"piece"}
                        draggable="true"
                        onDragStart={onDragStart}
                        className={`chess-piece ${getSizeClass(`$${piece.Color}-${piece.Type}`)}`}
                    />
                )}
            </div>
        </>
    );
};

export default ChessSquare;