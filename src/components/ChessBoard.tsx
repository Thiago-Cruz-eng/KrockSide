import React, {useEffect, useState} from 'react';
import '../styles/ChessBoard.css';
import * as signalR from "@microsoft/signalr";
import {useSignalR} from "./SignalRContext";
import { useParams } from 'react-router-dom';
import ChessSquare from "./ChessSquare";
import Piece from "../utils/ChessPiece";

interface Square {
    SquareColor: string | undefined;
    Piece: Piece | null;
    Row: number;
    Column: number;
}

const ChessBoard: React.FC = () => {
    const connectionOfWebSocket = useSignalR();
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
    const { roomName } = useParams();
    const [squares, setSquares] = useState<Square[]>([]);
    const [loading, setLoading] = useState(true); // State to track loading status

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
                        setLoading(false);
                    } catch (error) {
                        console.error("Error invoking StartGame:", error);
                    }
                };
                startGame();
            }, 1000)
        }
    }, [connection, roomName]);

    // Render only when loading is false
    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="chessboard">
            {[...Array(8)].map((_, col) => (
                <div key={col} className="row">
                    {[...Array(8)].map((_, row) => {
                        const square = squares.find(square => square.Row === row && square.Column === col);
                        return (
                            <ChessSquare
                                key={`${row}-${col}`}
                                color={square ? square.SquareColor : ''}
                                column={col}
                                row={row}
                                squareColor={square ? square.SquareColor : ''}
                                piece={square ? square.Piece : null}
                            />
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default ChessBoard;
