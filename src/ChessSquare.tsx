import React from 'react';
import './ChessSquare.css';
<<<<<<< HEAD
import {useSignalR} from "./SignalRContext";
import ChessPiece from "./ChessPiece";
import Position from "./Position"; // Import the CSS file for ChessSquare styles

const sendMove = async (connection: any, column: string, row: number, piece: any) => {
    const position = {

    }
    await connection.invoke("SendPossiblesMoves", "ThiagãoDasCouves5", actualRoomName)
};

const ChessSquare: React.FC<Position> = ({ column, row, piece, squareColor }) => {
    const connection = useSignalR();
    const squareColorClass = squareColor === 'dark' ? 'dark' : 'light';


    return (
        <div onClick={() => sendMove(connection, column, row, piece)} className={`square ${squareColorClass}`}>
            <img/>
=======
import {useSignalR} from "./SignalRContext"; // Import the CSS file for ChessSquare styles

interface ChessSquareProps {
    color: 'dark' | 'light';
    column: string;
    row: number;
    piece: any;
}

const sendMove = async (connection: any, column: string, row: number, piece: any) => {
    const position = {

    }
    await connection.invoke("SendPossiblesMoves", "ThiagãoDasCouves5", actualRoomName)
};

const ChessSquare: React.FC<ChessSquareProps> = ({ color, column, row, piece }) => {
    const connection = useSignalR();
    const squareColorClass = color === 'dark' ? 'dark' : 'light';


    return (
        <div onClick={() => sendMove(connection, column, row, piece)} className={`square ${squareColorClass}`}>
            <img src={piece}/>
>>>>>>> 9e1529c3b9c69e8f1ba53a5cba809d4a74d85671
            <span>{`${column}${row}`}</span>
        </div>
    );
};



export default ChessSquare;
