import React, {useState} from 'react';
import ChessSquare from "./ChessSquare";
import '../styles/ChessBoard.css';
import chessPiece from "../utils/ChessPiece";
import * as signalR from "@microsoft/signalr";

const ChessBoard: React.FC = () => {
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);

    const isDarkSquare = (rowIndex: number, colIndex: number) => {
        return (rowIndex + colIndex) % 2 === 1;
    };

    const initialBoardSetup = [
        ["black-rook", "black-knight", "black-bishop", "black-queen", "black-king", "black-bishop", "black-knight", "black-rook"],
        Array(8).fill("black-pawn"),
        ...Array(4).fill(Array(8).fill(null)),
        Array(8).fill("white-pawn"),
        ["white-rook", "white-knight", "white-bishop", "white-queen", "white-king", "white-bishop", "white-knight", "white-rook"],
    ];

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

    return (
        <div className="chessboard">
            {initialBoardSetup.map((row, rowIndex) => (
                <div key={rowIndex} className="row">
                    {row.map((piece: chessPiece, colIndex: number) => (
                        <ChessSquare
                            key={`${rowIndex}-${colIndex}`}
                            color={isDarkSquare(rowIndex, colIndex) ? 'dark' : 'light'}
                            column={colIndex + 1}
                            row={8 - rowIndex}
                            piece={piece}
                            onSquareClick={handleSquareClick}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
};

export default ChessBoard;
