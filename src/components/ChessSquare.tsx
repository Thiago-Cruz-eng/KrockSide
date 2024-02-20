import React from 'react';
import '../styles/ChessSquare.css';
import {useSignalR} from "./SignalRContext";
import ChessPiece from "../utils/ChessPiece";
import Position from "../utils/Position"; // Import the CSS file for ChessSquare styles

const sendMove = async (connection: any, position: Position) => {
    await connection.invoke("SendPossiblesMoves", "ThiagãoDasCouves5", position)
};

const ChessSquare: React.FC<Position> = ({ column, row, piece, squareColor }) => {
    const connection = useSignalR();
    const squareColorClass = squareColor === 'dark' ? 'dark' : 'light';

    const position = new Position(row,column,squareColor, piece);

    return (
        <div onClick={() => sendMove(connection, position)} className={`square ${squareColorClass}`}>
            <img/>
            <span>{`${column}${row}`}</span>
        </div>
    );
};



export default ChessSquare;
