import React from 'react';
import './ChessSquare.css';
import {useSignalR} from "./SignalRContext";
import ChessPiece from "./ChessPiece";
import Position from "./Position"; // Import the CSS file for ChessSquare styles

const sendMove = async (connection: any, column: string, row: number, piece: any) => {
    await connection.invoke("SendPossiblesMoves", "ThiagãoDasCouves5", actualRoomName)
};

const ChessSquare: React.FC<Position> = ({ column, row, piece, squareColor }) => {
    const connection = useSignalR();
    const squareColorClass = squareColor === 'dark' ? 'dark' : 'light';


    return (
        <div onClick={() => sendMove(connection, column, row, piece)} className={`square ${squareColorClass}`}>
            <img/>
            <span>{`${column}${row}`}</span>
        </div>
    );
};



export default ChessSquare;
