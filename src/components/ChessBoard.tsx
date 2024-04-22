import React, {useEffect, useState} from 'react';
import '../styles/ChessBoard.css';
import * as signalR from "@microsoft/signalr";
import {useSignalR} from "./SignalRContext";
import { useParams } from 'react-router-dom';
import ChessSquare from "./ChessSquare";
import Piece from "../utils/ChessPiece";
import Position from "../utils/Position";

interface Square {
    SquareColor: string | undefined;
    Piece: Piece | null;
    Row: number;
    Column: number;
    HighlightedPosition: boolean
    onSelectSquare: (row: number, column:number) => any
}

interface PossibleMoves {
    column: number;
    piece: any;
    row: number;
    squareColor: number;
}

const ChessBoard: React.FC = () => {
    const connectionOfWebSocket = useSignalR();
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
    const { roomName } = useParams();
    const [squares, setSquares] = useState<Square[]>([]);
    const [loading, setLoading] = useState(true); 

    useEffect(() => {
        setConnection(connectionOfWebSocket);
    }, []);

    useEffect(() => {
        if (connection) {
            setTimeout(() => {
                const startGame = async () => {
                    try {
                        const response = await connection.invoke("StartGame", roomName);
                        console.log(response);
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

    const handleSquare:any = (possibleMove: PossibleMoves[]): void => {
        setSquares(prevSquares => {
            return prevSquares.map(square => {
                const foundMove = possibleMove.find(move => move.column === square.Column && move.row === square.Row);
                if (foundMove) {
                    return {
                        ...square,
                        HighlightedPosition: true
                    };
                } else {
                    return {
                        ...square,
                        HighlightedPosition: false
                    };
                }
            });
        });
      
    }

    const handleChangeBoard:any = (change: boolean): void => {
        if(change && connection) {
            const rerenderGame = async () => {
                try {
                    console.log("@@@@@@@@@@@@@@###################")
                    let response: string  = await connection.invoke("GetPositionPlaced", roomName);
                    let squareMapped : Square[][] = JSON.parse(response)
                    console.log(squareMapped.flatMap(innerArray => innerArray.concat()));
                    setSquares(squareMapped.flatMap(innerArray => innerArray.concat()))
                    setLoading(false);
                } catch (error) {
                    console.error("Error invoking StartGame:", error);
                }
                change = false;
            };
            rerenderGame()
        }

    }

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
                                highlighted= {square?.HighlightedPosition ? false : true}
                                onSelectSquare={handleSquare}
                                onChangeBoard={handleChangeBoard}
                            />
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default ChessBoard;
