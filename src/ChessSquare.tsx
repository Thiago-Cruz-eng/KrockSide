import React from 'react';
import './ChessSquare.css';
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
            <span>{`${column}${row}`}</span>
        </div>
    );
};



export default ChessSquare;
