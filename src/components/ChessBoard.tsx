import React, {useEffect, useState} from 'react';
import ChessSquare from "./ChessSquare";
import '../styles/ChessBoard.css';
import chessPiece from "../utils/ChessPiece";
import * as signalR from "@microsoft/signalr";
import {useSignalR} from "./SignalRContext";
import { useParams } from 'react-router-dom';

const ChessBoard: React.FC = () => {
    const connectionOfWebSocket = useSignalR();
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
    const { roomName } = useParams();

    useEffect(() => {
        setConnection(connectionOfWebSocket);
    }, []);
    const isDarkSquare = (rowIndex: number, colIndex: number) => {
        return (rowIndex + colIndex) % 2 === 1;
    };


    //INICIALIZAR ESSA CHAMA NO CHESS-BOARD SENDO A PRIMEIRA COISA A SER FEITA
    //MAPEAR PEÇAS DE ACORDO E GERAR O BOARD
    const response = await connection.invoke("StartGame", roomName);

    console.log(response);


    return (

        <div className="chessboard">

                <div className="row">
                    {/*{row.map((piece: string, colIndex: number) =>*/}
                    {/*{*/}
                    {/*    return (*/}
                    {/*    <ChessSquare*/}
                    {/*        key={`${rowIndex}-${colIndex}`}*/}
                    {/*        color={isDarkSquare(rowIndex, colIndex) ? 'Black' : 'White'}*/}
                    {/*        column={colIndex + 1}*/}
                    {/*        row={8 - rowIndex}*/}
                    {/*        pieceName={piece}*/}
                    {/*        piece={pec}*/}
                    {/*    />*/}
                    {/*)})}*/}
                </div>
        </div>
    );
};

export default ChessBoard;
