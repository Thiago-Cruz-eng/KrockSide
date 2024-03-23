import React, {useEffect, useState} from 'react';
import '../styles/ChessBoard.css';
import * as signalR from "@microsoft/signalr";
import {useSignalR} from "./SignalRContext";
import { useParams } from 'react-router-dom';
import ChessSquare from "./ChessSquare";
import Piece from "../utils/ChessPiece";

interface Square {
    SquareColor: string;
    Piece: Piece;
    Row: number;
    Column: number;
}

const ChessBoard: React.FC = () => {
    const connectionOfWebSocket = useSignalR();
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
    const { roomName } = useParams();
    const [squares, setSquares] = useState<Square[]>([]);

    useEffect(() => {
        setConnection(connectionOfWebSocket);
    }, []);

    useEffect(() => {
        // Ensure connection exists before invoking
        if (connection) {
            setTimeout(() => {
                const startGame = async () => {
                    try {
                        const response = await connection.invoke("StartGame", roomName);
                        console.log(JSON.parse(response));
                        setSquares(JSON.parse(response))
                    } catch (error) {
                        console.error("Error invoking StartGame:", error);
                    }
                };
                startGame();
            }, 1000)
        }
    }, [connection, roomName]);

    return (

        <div className="chessboard">
            {squares.map((square, index) => (
                <div key={index} className="row">
                        <ChessSquare
                            key={`${index}-${index}`}
                            color= {square.SquareColor}
                            column={square.Column}
                            row={square.Row}
                            pieceName={square.Piece.Type}
                            piece={square.Piece}
                        />
                </div>
            ))}
        </div>
    );
};

export default ChessBoard;
